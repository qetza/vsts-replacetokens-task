import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import iconv = require('iconv-lite');
import jschardet = require('jschardet');
import path = require('path');
import os = require('os');
import crypto = require('crypto');
import trackEvent, { TelemetryEvent } from './telemetry';

const ENCODING_AUTO: string = 'auto';
const ENCODING_ASCII: string = 'ascii';
const ENCODING_UTF_7: string = 'utf-7';
const ENCODING_UTF_8: string = 'utf-8';
const ENCODING_UTF_16LE: string = 'utf-16le';
const ENCODING_UTF_16BE: string = 'utf-16be';
const ENCODING_WIN1252: string = 'windows1252';
const ENCODING_ISO_8859_1: string = 'iso88591';

const ACTION_WARN: string = 'warn';
const ACTION_FAIL: string = 'fail';

const XML_ESCAPE: RegExp = /[<>&'"]/g;
const JSON_ESCAPE: RegExp = /["\\\b\f\n\r\t]/g;
const WIN32_DIRECTORY_SEPARATOR: RegExp = /\\/g;
const POSIX_DIRECTORY_SEPARATOR: RegExp = /\//g;
const OUTPUT_WILDCARD: RegExp = /\*/g;

interface Options {
    readonly encoding: string, 
    readonly keepToken: boolean,
    readonly actionOnMissing: string, 
    readonly writeBOM: boolean, 
    readonly emptyValue: string, 
    readonly escapeType: string,
    readonly escapeChar: string, 
    readonly charsToEscape: string,
    readonly verbosity: string
}

interface Rule {
    isInputWildcard: boolean,
    inputPatterns: string[],
    isOutputRelative: boolean,
    outputPattern: string
}

interface ILogger {
    debug(message: string): void,
    info(message: string): void,
    warn(message: string): void,
    error(message: string): void
}

class NullLogger implements ILogger {
    public debug(message: string): void {}
    public info(message: string): void {}
    public warn(message: string): void {}
    public error(message: string): void {}
}

enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
    Off = 255
}

class Logger implements ILogger {
    private _level: LogLevel;
    
    constructor(level: LogLevel) {
        this._level = level;
    }

    public debug(message: string): void {
        this.log(LogLevel.Debug, message);
    }

    public info(message: string): void {
        this.log(LogLevel.Info, message);
    }

    public warn(message: string): void {
        this.log(LogLevel.Warn, message);
    }

    public error(message: string): void {
        this.log(LogLevel.Error, message);
    }

    private log(level: LogLevel, message: string): void {
        // always log debug to system debug
        if (level === LogLevel.Debug)
            tl.debug(message);
        
        // always set task result on error
        if (level === LogLevel.Error)
            tl.setResult(tl.TaskResult.Failed, message);

        if (level < this._level)
            return;

        switch (level)
        {
            case LogLevel.Debug:
            case LogLevel.Info:
                console.log(message);
                break;

            case LogLevel.Warn:
                tl.warning(message);
                break;
        }
           
    }
}

class Counter {
    public Tokens: number = 0;
    public Replaced: number = 0;
    public Files: number = 0;
}

var logger: ILogger = new NullLogger();
var globalCounters: Counter = new Counter(); 
var fileVariables: {[name: string]: string} = {};

var mapEncoding = function (encoding: string): string {
    switch (encoding)
    {
        case 'auto':
            return ENCODING_AUTO;

        case 'Ascii':
        case 'ascii': 
            return ENCODING_ASCII;

        case 'UTF7':
        case 'utf-7': 
            return ENCODING_UTF_7;

        case 'UTF8':
        case 'utf-8': 
            return ENCODING_UTF_8;

        case 'Unicode':
        case 'utf-16le': 
            return ENCODING_UTF_16LE;

        case 'BigEndianUnicode':
        case 'utf-16be': 
            return ENCODING_UTF_16BE;

        case 'win1252':
            return ENCODING_WIN1252;
        
        case 'iso88591':
            return ENCODING_ISO_8859_1;

        case 'UTF32':
            throw new Error('utf-32 encoding is no more supported.');

        case 'BigEndianUTF32':
            throw new Error('utf-32be encoding is no more supported.');

        default:
            throw new Error('invalid encoding: ' + encoding);
    }
}

var getEncoding = function (filePath: string): string {
    let buffer: Buffer = fs.readFileSync(filePath, { flag: 'r' });
    let charset: any = jschardet.detect(buffer);

    switch (charset.encoding)
    {
        case 'ascii':
            return ENCODING_ASCII;

        case 'UTF-8':
            return ENCODING_UTF_8;

        case 'UTF-16LE':
            return ENCODING_UTF_16LE;

        case 'UTF-16BE':
            return ENCODING_UTF_16BE;

        case 'windows-1252':
            return ENCODING_WIN1252;

        default:
            return ENCODING_ASCII;
    }
}

var loadVariablesFromJson = function(
    value: any, 
    name: string,
    separator: string,
    variables: { [name: string] : string; }): number
{
    let count: number = 0;
    let type: string = typeof(value);

    let prefix: string = name;
    if (name.length != 0)
        prefix += separator;

    if (value === null || type == "boolean" || type == "number" || type == "string")
    {
        variables[name] = (value === null ? "" : value) + "";

        ++count;
        logger.debug('  loaded variable: ' + name);
    }
    else if (Array.isArray(value))
    {
        value.forEach((v: any, i: number) => {
            count += loadVariablesFromJson(v, prefix + i, separator, variables);
        });
    }
    else if (type == "object")
    {
        Object.keys(value).forEach(key => {
            count += loadVariablesFromJson(value[key], prefix + key, separator, variables);
        });
    }

    return count;
}

var replaceTokensInFile = function (
    filePath: string, 
    outputPath: string,
    regex: RegExp, 
    options: Options): void {
    logger.info('replacing tokens in: ' + filePath);

    if (filePath !== outputPath)
        logger.info('  output in: ' + outputPath);

    // ensure encoding
    let encoding: string = options.encoding;
    if (options.encoding === ENCODING_AUTO)
        encoding = getEncoding(filePath);

    logger.debug('  using encoding: ' + encoding);

    // read file and replace tokens
    let localCounter: Counter = new Counter();

    let content: string = iconv.decode(fs.readFileSync(filePath), encoding);
    content = content.replace(regex, (match, name) => {
        ++localCounter.Tokens;

        let value: string = tl.getVariable(name);
        if (name in fileVariables)
            value = fileVariables[name];

        if (!value)
        {
            if (options.keepToken)
                value = match;
            else
                value = '';

            let message: string = '  variable not found: ' + name;
            switch (options.actionOnMissing)
            {
                case ACTION_WARN:
                    logger.warn(message);
                    break;

                case ACTION_FAIL:
                    logger.error(message);
                    break;

                default:
                    logger.debug(message);
            }
        }
        else
        {
            ++localCounter.Replaced;

            if (options.emptyValue && value === options.emptyValue)
                value = '';
        }

        let escapeType: string = options.escapeType;
        if (escapeType === 'auto')
        {
            switch (path.extname(filePath)) {
                case '.json':
                    escapeType = 'json';
                    break;

                case '.xml':
                    escapeType = 'xml';
                    break;

                default:
                    escapeType = 'none';
                    break;
            }
        }

        // log value before escaping to show raw value and avoid secret leaks (escaped secrets are not replaced by ***)
        logger.debug('  ' + name + ': ' + value);

        switch (escapeType) {
            case 'json':
                value = value.replace(JSON_ESCAPE, match => {
                    switch (match) {
                        case '"':
                        case '\\':
                            return '\\' + match;
                        
                        case '\b': return "\\b";
                        case '\f': return "\\f";
                        case '\n': return "\\n";
                        case '\r': return "\\r";
                        case '\t': return "\\t";
                    }
                });
                break;

            case 'xml':
                value = value.replace(XML_ESCAPE, match => {
                    switch (match) {
                        case '<': return '&lt;';
                        case '>': return '&gt;';
                        case '&': return '&amp;';
                        case '\'': return '&apos;';
                        case '"': return '&quot;';
                    }
                });
                break;

            case 'custom':
                if (options.escapeChar && options.charsToEscape)
                    for (var c of options.charsToEscape)
                        // split and join to avoid regex and escaping escape char
                        value = value.split(c).join(options.escapeChar + c);
                break;
        }

        return value;
    });

    // ensure outputPath directory exists
    let mkdirSyncRecursive = function (p: string) {
        if (fs.existsSync(p))
            return;
        
        mkdirSyncRecursive(path.dirname(p));

        fs.mkdirSync(p);
        logger.debug('  created folder: ' + p);
    };
    mkdirSyncRecursive(path.dirname(path.resolve(outputPath)));

    // write file & log
    fs.writeFileSync(outputPath, iconv.encode(content, encoding, { addBOM: options.writeBOM, stripBOM: null, defaultEncoding: null }));
    logger.info('  ' + localCounter.Replaced + ' tokens replaced out of ' + localCounter.Tokens);

    globalCounters.Tokens += localCounter.Tokens;
    globalCounters.Replaced += localCounter.Replaced;
}

var mapLogLevel = function (level: string): LogLevel {
    switch (level)
    {
        case "normal":
            return LogLevel.Info;
        
        case "detailed":
            return LogLevel.Debug;
        
        case "off":
            return LogLevel.Off;
    }

    return LogLevel.Info;
}

var normalize = function (p: string): string {
    return os.platform() === 'win32'
        ? p.replace(POSIX_DIRECTORY_SEPARATOR, '\\')
        : p.replace(WIN32_DIRECTORY_SEPARATOR, '/');
}

async function run() {
    let startTime: Date = new Date();
    let serverType = tl.getVariable('System.ServerType').toLowerCase();
    let telemetryEnabled = tl.getBoolInput('enableTelemetry', true) && tl.getVariable('REPLACETOKENS_DISABLE_TELEMETRY') !== 'true';

    let proxyUrl: string = undefined;
    let config = tl.getHttpProxyConfiguration();
    if (config)
        proxyUrl = config.proxyUrl;

    let telemetryEvent = {
        account: crypto.createHash('sha256').update(tl.getVariable('system.collectionid')).digest('hex'),
        pipeline: crypto.createHash('sha256').update(tl.getVariable('system.teamprojectid') + tl.getVariable('system.definitionid')).digest('hex'),
        pipelineType: tl.getVariable('release.releaseid') ? 'release' : 'build',
        serverType: !serverType || serverType !== 'hosted' ? 'server' : 'services',
    } as TelemetryEvent;

    try {
        // load inputs
        let root: string = tl.getPathInput('rootDirectory', false, true);
        let tokenPrefix: string = tl.getInput('tokenPrefix', true);
        let tokenSuffix: string = tl.getInput('tokenSuffix', true);
        let options: Options = {
            encoding: mapEncoding(tl.getInput('encoding', true)),
            keepToken: tl.getBoolInput('keepToken', true),
            actionOnMissing: tl.getInput('actionOnMissing', true),
            writeBOM: tl.getBoolInput('writeBOM', true),
            emptyValue: tl.getInput('emptyValue', false),
            escapeType: tl.getInput('escapeType', false),
            escapeChar: tl.getInput('escapeChar', false),
            charsToEscape: tl.getInput('charsToEscape', false),
            verbosity: tl.getInput('verbosity', true)
        };

        logger = new Logger(mapLogLevel(options.verbosity));

        let rules: Rule[] = [];
        let ruleUsingInputWildcardCount: number = 0;
        let ruleUsingNegativeInputPattern: number = 0;
        let ruleUsingOutputPatternCount: number = 0;

        tl.getDelimitedInput('targetFiles', '\n', true).forEach((l: string) => {
            if (l)
                l.split(',').forEach((line: string) => {
                    if (line)
                    {
                        let ruleParts: string[] = line.split('=>');
                        let rule: Rule = { 
                            isInputWildcard: false,
                            inputPatterns: normalize(ruleParts[0].trim()).split(';'),
                            isOutputRelative: false, 
                            outputPattern: null
                        };

                        rule.isInputWildcard = path.basename(rule.inputPatterns[0]).indexOf('*') != -1;

                        if (ruleParts.length > 1)
                        {
                            rule.outputPattern = normalize(ruleParts[1].trim());
                            rule.isOutputRelative = !path.isAbsolute(rule.outputPattern)
                        }

                        rules.push(rule);

                        if (ruleParts[0].indexOf('!') != -1)
                            ++ruleUsingNegativeInputPattern;

                        if (rule.isInputWildcard)
                            ++ruleUsingInputWildcardCount;
                        
                        if (rule.outputPattern)
                            ++ruleUsingOutputPatternCount;
                    }
                })
        });

        let variableSeparator: string = tl.getInput('variableSeparator', false);
        let variableFilesCount: number = 0;

        tl.getDelimitedInput('variableFiles', '\n', false).forEach((l: string) => {
            if (l)
                l.split(',').forEach((path: string) => {
                    if (path)
                    {
                        tl.findMatch(root, normalize(path)).forEach(filePath => {
                            if (tl.stats(filePath).isDirectory())
                                return;
            
                            if (!tl.exist(filePath))
                            {
                                logger.error('file not found: ' + filePath);
            
                                return;
                            }

                            logger.info('loading variables from: ' + filePath);

                            let encoding: string = getEncoding(filePath);
                            let variables: any = JSON.parse(iconv.decode(fs.readFileSync(filePath), encoding));

                            let count: number = loadVariablesFromJson(variables, '', variableSeparator, fileVariables);

                            logger.info('  ' + count + ' variable(s) loaded.');
                            ++variableFilesCount;
                        });
                    }
                });
        });

        // initialize task
        let escapedTokenPrefix: string = tokenPrefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let escapedTokenSuffix: string = tokenSuffix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let regex: RegExp = new RegExp(escapedTokenPrefix + '\\s*((?:(?!\\s*' + escapedTokenSuffix + ').)*)\\s*' + escapedTokenSuffix, 'gm');
        logger.debug('pattern: ' + regex.source);

        // set telemetry data
        telemetryEvent.actionOnMissing = options.actionOnMissing;
        telemetryEvent.charsToEscape = options.charsToEscape;
        telemetryEvent.emptyValue = options.emptyValue;
        telemetryEvent.encoding = options.encoding;
        telemetryEvent.escapeChar = options.escapeChar;
        telemetryEvent.escapeType = options.escapeType;
        telemetryEvent.keepToken = options.keepToken;
        telemetryEvent.pattern = regex.source;
        telemetryEvent.result = 'succeeded';
        telemetryEvent.rules = rules.length;
        telemetryEvent.rulesWithInputWildcard = ruleUsingInputWildcardCount;
        telemetryEvent.rulesWithNegativePattern = ruleUsingNegativeInputPattern;
        telemetryEvent.rulesWithOutputPattern = ruleUsingOutputPatternCount;
        telemetryEvent.tokenPrefix = tokenPrefix;
        telemetryEvent.tokenSuffix = tokenSuffix;
        telemetryEvent.variableFiles = variableFilesCount;
        telemetryEvent.variableSeparator = variableSeparator;
        telemetryEvent.verbosity = options.verbosity;
        telemetryEvent.writeBOM = options.writeBOM;

        // process files
        rules.forEach(rule => {
            tl.findMatch(root, rule.inputPatterns).forEach(filePath => {
                if (tl.stats(filePath).isDirectory())
                    return;

                if (!tl.exist(filePath))
                {
                    logger.error('file not found: ' + filePath);

                    return;
                }

                let outputPath: string = filePath;
                if (rule.outputPattern)
                {
                    outputPath = rule.outputPattern;

                    if (rule.isInputWildcard)
                    {
                        let inputBasename: string = path.basename(rule.inputPatterns[0]);
                        let inputWildcardIndex = inputBasename.indexOf('*');
                        let fileBasename: string = path.basename(filePath);
                        let token: string = fileBasename.substring(inputWildcardIndex, fileBasename.length - (inputBasename.length - inputWildcardIndex -1));

                        outputPath = outputPath.replace(OUTPUT_WILDCARD, token);
                    }

                    if (rule.isOutputRelative)
                        outputPath = path.join(path.dirname(filePath), outputPath);
                }

                replaceTokensInFile(filePath, outputPath, regex, options);
                ++globalCounters.Files;
            });
        });

        let duration = (+new Date() - (+startTime)) / 1000;
        logger.info('replaced ' + globalCounters.Replaced + ' tokens out of ' + globalCounters.Tokens + ' in ' + globalCounters.Files + ' file(s) in ' + duration + ' seconds.');

        telemetryEvent.duration = duration;
        telemetryEvent.tokenReplaced = globalCounters.Replaced;
        telemetryEvent.tokenFound = globalCounters.Tokens;
        telemetryEvent.fileProcessed = globalCounters.Files;
    }
    catch (err)
    {
        telemetryEvent.result = 'failed';

        logger.error(err.message);
    }
    finally
    {
        if (telemetryEnabled)
        {
            var trackedData = trackEvent(telemetryEvent, proxyUrl);
            tl.debug('sent usage telemetry: ' + JSON.stringify(trackedData));
        }
    }
}

run();