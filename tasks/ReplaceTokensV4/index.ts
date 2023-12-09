import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import iconv = require('iconv-lite');
import jschardet = require('jschardet');
import path = require('path');
import os = require('os');
import crypto = require('crypto');
import trackEvent, { TelemetryEvent } from './telemetry';
import yaml = require('js-yaml');
import stripJsonComments from './strip-json-comments';

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
const NEWLINE: RegExp = /(\r?\n)/g;

interface Options {
    readonly encoding: string, 
    readonly keepToken: boolean,
    readonly actionOnMissing: string, 
    readonly writeBOM: boolean, 
    readonly emptyValue: string, 
    readonly escapeType: string,
    readonly escapeChar: string, 
    readonly charsToEscape: string,
    readonly verbosity: string,
    readonly defaultValue: string,
    readonly enableTransforms: boolean,
    readonly enableRecursion: boolean,
    readonly useLegacyEmptyFeature: boolean,
    readonly useDefaultValue: boolean,
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
    public error(message: string): void {
        // always set task result on error
        tl.setResult(tl.TaskResult.Failed, message);
    }
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
    public DefaultValues: number = 0;
    public Transforms: number = 0;
}

var logger: ILogger = new NullLogger();
var globalCounters: Counter = new Counter();
var externalVariables: {[name: string]: string} = {};

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

var replaceTokensInString = function (
    content: string,
    regex: RegExp,
    transformRegex: RegExp,
    options: Options,
    enableEscape: boolean,
    escapeType: string,
    counter: Counter,
    names: string[]): string {

    names = names || [];
    content = content.replace(regex, (match, name) => {
        ++counter.Tokens;

        // extract transformation
        let transformName: string = null;
        let transformParameters: string[] = [];
        if (options.enableTransforms)
        {
            let m = name.match(transformRegex);
            if (m)
            {
                ++counter.Transforms;

                transformName = (m[1] || '').toLowerCase();
                transformParameters = m[2].split(',').map((a: string) => a.trim()); // support parameters
                name = transformParameters.shift();
            }
        }

        // check cycle on recursion
        if (options.enableRecursion && names.indexOf(name) >= 0)
            throw new Error("recursion cycle with token '" + name + "'.");

        // replace value
        let value: string = tl.getVariable(name);
        if (name in externalVariables)
            value = externalVariables[name];

        let usedDefaultValue: boolean = false;
        if ((options.useLegacyEmptyFeature && !value && options.defaultValue) // old empty/default feature
            || (!options.useLegacyEmptyFeature && options.useDefaultValue && value === undefined)) // new empty/default feature
        {
            ++counter.DefaultValues;

            value = options.defaultValue;
            usedDefaultValue = true;
        }

        if ((options.useLegacyEmptyFeature && !value) // old empty/default feature
            || (!options.useLegacyEmptyFeature && value === undefined)) // new empty/default feature
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
            ++counter.Replaced;

            if (options.useLegacyEmptyFeature && options.emptyValue && value === options.emptyValue) // old empty/default feature
                value = '';

            // apply recursion on non-empty value (never apply escape)
            if (value && options.enableRecursion)
                value = replaceTokensInString(value, regex, transformRegex, options, false, escapeType, counter, names.concat(name));

            // apply transformation
            if (transformName)
            {
                switch (transformName) {
                    case 'lower':
                        value = value.toLowerCase();
                        break;

                    case 'upper':
                        value = value.toUpperCase();
                        break;

                    case 'noescape':
                        // nothing done here, disable escaping later
                        break;

                    case 'base64':
                        value = Buffer.from(value).toString('base64');
                        break;

                    case 'indent':
                        var indentText = ' '.repeat(parseInt(transformParameters[0]) || 2);
                        value = value.replace(NEWLINE, '$1' + indentText)

                        if ((transformParameters[1] || '').toLocaleLowerCase() === 'true') // indent first line
                            value = indentText + value;
                        break;

                    default:
                        --counter.Transforms;
                        logger.warn('  unknown transform: ' + transformName);
                        break;
                }
            }
        }

        // log value before escaping to show raw value and avoid secret leaks (escaped secrets are not replaced by ***)
        logger.debug('  ' + name + ': ' + value + (usedDefaultValue ? ' (default value)' : ''));

        if (enableEscape)
        {
            let valueEscapeType: string = escapeType;
            if (transformName === 'noescape')
            {
                valueEscapeType = 'none';
            }

            switch (valueEscapeType) {
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
        }

        return value;
    });

    return content;
}

var replaceTokensInFile = function (
    filePath: string, 
    outputPath: string,
    regex: RegExp, 
    transformRegex: RegExp,
    options: Options): void {
    logger.info('##[group]replacing tokens in: ' + filePath);

    try
    {
        if (filePath !== outputPath)
            logger.info('  output in: ' + outputPath);

        // ensure encoding
        let encoding: string = options.encoding;
        if (options.encoding === ENCODING_AUTO)
            encoding = getEncoding(filePath);

        logger.debug('  using encoding: ' + encoding);

        // escape type
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

        // read file and replace tokens
        let localCounter: Counter = new Counter();
        let content: string = iconv.decode(fs.readFileSync(filePath), encoding);

        content = replaceTokensInString(content, regex, transformRegex, options, true, escapeType, localCounter, []);

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
        if (localCounter.Tokens)
        {
            // always write if tokens found
            fs.writeFileSync(outputPath, iconv.encode(content, encoding, { addBOM: options.writeBOM, stripBOM: null, defaultEncoding: null }));
        }
        else if (filePath !== outputPath)
        {
            // copy original file if output is different (not using copyFileSync to support node 6.x)
            fs.writeFileSync(outputPath, fs.readFileSync(filePath));
        }

        logger.info('  ' + localCounter.Replaced + ' token(s) replaced out of ' + localCounter.Tokens + (localCounter.DefaultValues ? ' (using ' + localCounter.DefaultValues + ' default value(s))' : '') + (options.enableTransforms ? ' and running ' + localCounter.Transforms + ' transformation(s)' : ''));

        globalCounters.Tokens += localCounter.Tokens;
        globalCounters.Replaced += localCounter.Replaced;
        globalCounters.DefaultValues += localCounter.DefaultValues;
        globalCounters.Transforms += localCounter.Transforms;
    }
    finally
    {
        logger.info('##[endgroup]');
    }
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
    // initialize telemetry (outside of try as needed in catch and finally)
    let telemetryEnabled: boolean = false;
    let telemetryEvent: TelemetryEvent = {} as TelemetryEvent;

    let proxyUrl: string | undefined = undefined;
    const config = tl.getHttpProxyConfiguration();
    if (config)
        proxyUrl = config.proxyUrl;

    // make all code in try/catch to set the task result
    try {
        const startTime: Date = new Date();
        const serverType = tl.getVariable('System.ServerType');
        telemetryEnabled = tl.getBoolInput('enableTelemetry', false) && tl.getVariable('REPLACETOKENS_DISABLE_TELEMETRY') !== 'true';

        telemetryEvent.account = crypto.createHash('sha256').update(tl.getVariable('system.collectionid')).digest('hex');
        telemetryEvent.pipeline = crypto.createHash('sha256').update(tl.getVariable('system.teamprojectid') + tl.getVariable('system.definitionid')).digest('hex');
        telemetryEvent.pipelineType = tl.getVariable('release.releaseid') ? 'release' : 'build';
        telemetryEvent.serverType = !serverType || serverType.toLowerCase() !== 'hosted' ? 'server' : 'services';

        // load inputs
        const root: string = tl.getPathInput('rootDirectory', false, true);
        const tokenPattern: string = tl.getInput('tokenPattern', false) || 'default';
        let tokenPrefix: string = tl.getInput('tokenPrefix', false) || '#{';
        let tokenSuffix: string = tl.getInput('tokenSuffix', false) || '}#';
        const useLegacyPattern: boolean = tl.getBoolInput('useLegacyPattern', false);
        const options: Options = {
            encoding: mapEncoding(tl.getInput('encoding', false) || 'auto'),
            keepToken: tl.getBoolInput('keepToken', false),
            actionOnMissing: tl.getInput('actionOnMissing', false) || 'warn',
            writeBOM: tl.getBoolInput('writeBOM', false),
            emptyValue: tl.getInput('emptyValue', false),
            escapeType: tl.getInput('escapeType', false),
            escapeChar: tl.getInput('escapeChar', false),
            defaultValue: tl.getInput('defaultValue', false) || '',
            charsToEscape: tl.getInput('charsToEscape', false),
            verbosity: tl.getInput('verbosity', false) || 'normal',
            enableTransforms: tl.getBoolInput('enableTransforms', false),
            enableRecursion: tl.getBoolInput('enableRecursion', false),
            useLegacyEmptyFeature: tl.getBoolInput('useLegacyEmptyFeature', false),
            useDefaultValue: tl.getBoolInput('useDefaultValue', false),
        };
        const transformPrefix: string = tl.getInput('transformPrefix', false) || '(';
        const transformSuffix: string = tl.getInput('transformSuffix', false) || ')';
        const actionOnNoFiles: string = tl.getInput('actionOnNoFiles', false) || 'continue';

        logger = new Logger(mapLogLevel(options.verbosity));

        const rules: Rule[] = [];
        let ruleUsingInputWildcardCount: number = 0;
        let ruleUsingNegativeInputPattern: number = 0;
        let ruleUsingOutputPatternCount: number = 0;

        tl.getDelimitedInput('targetFiles', '\n', true).forEach((l: string) => {
            if (l)
                l.split(',').forEach((line: string) => {
                    if (line)
                    {
                        const ruleParts: string[] = line.split('=>');
                        const rule: Rule = { 
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

        const variableSeparator: string = tl.getInput('variableSeparator', false);
        let variableFilesCount: number = 0;

        tl.getDelimitedInput('variableFiles', '\n', false).forEach((l: string) => {
            if (l)
                l.split(',').forEach((p: string) => {
                    if (p)
                    {
                        tl.findMatch(root, normalize(p)).forEach(filePath => {
                            if (tl.stats(filePath).isDirectory())
                                return;
            
                            if (!tl.exist(filePath))
                            {
                                logger.error('file not found: ' + filePath);
            
                                return;
                            }

                            logger.info('##[group]loading variables from: ' + filePath);

                            try
                            {
                                const encoding: string = getEncoding(filePath);
                                const extension: string = path.extname(filePath).toLowerCase();
                                const content: string = iconv.decode(fs.readFileSync(filePath), encoding);

                                if (extension === '.yaml' || extension === '.yml')
                                {
                                    let count: number = 0;
                                    yaml.loadAll(content, (variables: any) => {
                                        count += loadVariablesFromJson(variables, '', variableSeparator, externalVariables);
                                    });

                                    logger.info('  ' + count + ' variable(s) loaded.');
                                }
                                else
                                {
                                    const variables: any = JSON.parse(stripJsonComments(content));
                                    const count: number = loadVariablesFromJson(variables, '', variableSeparator, externalVariables);

                                    logger.info('  ' + count + ' variable(s) loaded.');
                                }

                                ++variableFilesCount;
                            }
                            finally
                            {
                                logger.info('##[endgroup]');
                            }
                        });
                    }
                });
        });

        let inlineVariablesCount: number = 0;
        const inlineVariables: string = tl.getInput('inlineVariables', false);

        if (inlineVariables)
        {
            logger.info('##[group]loading inline variables:');

            try
            {
                let count: number = 0;
                yaml.loadAll(inlineVariables, (variables: any) => {
                    count += loadVariablesFromJson(variables, '', variableSeparator, externalVariables);
                });

                logger.info('  ' + count + ' variable(s) loaded.');
            }
            finally
            {
                logger.info('##[endgroup]');
            }
        }

        // initialize task
        switch (tokenPattern)
        {
            case 'default':
                tokenPrefix = '#{';
                tokenSuffix = '}#';
                break;

            case 'rm':
                tokenPrefix = '__';
                tokenSuffix = '__';
                break;

            case 'octopus':
                tokenPrefix = '#{';
                tokenSuffix = '}';
                break;

            case 'azpipelines':
                tokenPrefix = '$(';
                tokenSuffix = ')';
                break;

            case 'doublebraces':
                tokenPrefix = '{{';
                tokenSuffix = '}}';
                break;
        }

        const escapedTokenPrefix: string = tokenPrefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escapedTokenSuffix: string = tokenSuffix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const pattern = useLegacyPattern 
            ? escapedTokenPrefix + '((?:(?!' + escapedTokenSuffix + ').)*)' + escapedTokenSuffix
            : escapedTokenPrefix + '\\s*((?:(?!' + escapedTokenPrefix + ')(?!\\s*' + escapedTokenSuffix + ').)*)\\s*' + escapedTokenSuffix;
        const regex: RegExp = new RegExp(pattern, 'gm');
        logger.debug('pattern: ' + regex.source);

        const escapedTransformPrefix: string = transformPrefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escapedTransformSuffix: string = transformSuffix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const transformPattern = '\\s*(.*)' + escapedTransformPrefix + '\\s*((?:(?!' + escapedTransformPrefix + ')(?!\\s*' + escapedTransformSuffix + ').)*)\\s*' + escapedTransformSuffix + '\\s*';
        const transformRegex: RegExp = new RegExp(transformPattern);
        logger.debug('transform pattern: ' + transformRegex.source);

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
        telemetryEvent.useLegacyPattern = useLegacyPattern;
        telemetryEvent.enableTransforms = options.enableTransforms;
        telemetryEvent.transformPrefix = transformPrefix;
        telemetryEvent.transformSuffix = transformSuffix;
        telemetryEvent.transformPattern = transformPattern;
        telemetryEvent.defaultValue = options.defaultValue;
        telemetryEvent.tokenPattern = tokenPattern;
        telemetryEvent.actionOnNoFiles = actionOnNoFiles;
        telemetryEvent.inlineVariables = inlineVariablesCount;
        telemetryEvent.enableRecursion = options.enableRecursion;
        telemetryEvent.useLegacyEmptyFeature = options.useLegacyEmptyFeature;
        telemetryEvent.useDefaultValue = options.useDefaultValue;

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
                        const inputBasename: string = path.basename(rule.inputPatterns[0]);
                        const inputWildcardIndex = inputBasename.indexOf('*');
                        const fileBasename: string = path.basename(filePath);
                        const token: string = fileBasename.substring(inputWildcardIndex, fileBasename.length - (inputBasename.length - inputWildcardIndex -1));

                        outputPath = outputPath.replace(OUTPUT_WILDCARD, token);
                    }

                    if (rule.isOutputRelative)
                        outputPath = path.join(path.dirname(filePath), outputPath);
                }

                replaceTokensInFile(filePath, outputPath, regex, transformRegex, options);
                ++globalCounters.Files;
            });
        });

        // set output variables
        tl.setVariable('tokenReplacedCount', globalCounters.Replaced.toString());
        tl.setVariable('tokenFoundCount', globalCounters.Tokens.toString());
        tl.setVariable('fileProcessedCount', globalCounters.Files.toString());
        tl.setVariable('transformExecutedCount', globalCounters.Transforms.toString());
        tl.setVariable('defaultValueCount', globalCounters.DefaultValues.toString());

        // display summary
        const duration = (+new Date() - (+startTime)) / 1000;

        if (globalCounters.Files === 0 && actionOnNoFiles === ACTION_WARN)
        {
            logger.warn('found no files to process in ' + duration + ' seconds.');
        }
        else if (globalCounters.Files === 0 && actionOnNoFiles === ACTION_FAIL)
        {
            logger.error('found no files to process in ' + duration + ' seconds.');
        }
        else
        {
            logger.info('replaced ' + globalCounters.Replaced + ' tokens out of ' + globalCounters.Tokens + (globalCounters.DefaultValues ? ' (using ' + globalCounters.DefaultValues + ' default value(s))' : '') + (options.enableTransforms ? ' and running ' + globalCounters.Transforms + ' functions' : '') + ' in ' + globalCounters.Files + ' file(s) in ' + duration + ' seconds.');
        }

        telemetryEvent.duration = duration;
        telemetryEvent.tokenReplaced = globalCounters.Replaced;
        telemetryEvent.tokenFound = globalCounters.Tokens;
        telemetryEvent.defaultValueReplaced = globalCounters.DefaultValues;
        telemetryEvent.fileProcessed = globalCounters.Files;
        telemetryEvent.transformExecuted = globalCounters.Transforms;
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
            const trackedData = trackEvent(telemetryEvent, proxyUrl);
            tl.debug('sent usage telemetry: ' + JSON.stringify(trackedData));
        }
    }
}

run();
