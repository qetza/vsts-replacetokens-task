import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import path = require('path');
import fs = require('fs');
import iconv = require('iconv-lite');

const ENCODING_AUTO: string = 'auto';
const ENCODING_ASCII: string = 'ascii';
const ENCODING_UTF_7: string = 'utf-7';
const ENCODING_UTF_8: string = 'utf-8';
const ENCODING_UTF_16LE: string = 'utf-16le';
const ENCODING_UTF_16BE: string = 'utf-16be';

const ACTION_WARN: string = 'warn';
const ACTION_FAIL: string = 'fail';

var getMatchingFiles = function (pattern: string, root: string): string[] {
    let matches: string[] = [];

    if (pattern && (pattern.indexOf('*') >= 0 || pattern.indexOf('?') >= 0))
    {
        if (!path.isAbsolute(pattern))
            pattern = path.join(root, pattern);
        
        matches = tl.glob(pattern);

        if (!matches.length)
            tl.warning('no file found for pattern: ' + pattern);
    }
    else
    {
        matches = pattern.split(';');

        for (let i = 0 ; i < matches.length ; ++i)
            if (!path.isAbsolute(matches[i]))
                matches[i] = path.join(root, matches[i]);
    }

    return matches;
}

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

        case 'UTF32':
            throw new Error('utf-32 encoding is no more supported.');

        case 'BigEndianUTF32':
            throw new Error('utf-32be encoding is no more supported.');

        default:
            throw new Error('invalid encoding: ' + encoding);
    }
}

var getEncoding = function (filePath: string): string {
    let fd: number = fs.openSync(filePath, 'r');

    try
    {
        let bytes: Buffer = new Buffer(4);
        fs.readSync(fd, bytes, 0, 4, 0);

        let encoding: string = ENCODING_ASCII;
        if (bytes[0] === 0x2b && bytes[1] === 0x2f && bytes[2] === 0x76 && (bytes[3] === 0x38 || bytes[3] === 0x39 || bytes[3] === 0x2b || bytes[3] === 0x2f))
            encoding = ENCODING_UTF_7;
        else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
            encoding = ENCODING_UTF_8
        else if (bytes[0] === 0xfe && bytes[1] === 0xff)
            encoding = ENCODING_UTF_16BE
        else if (bytes[0] === 0xff && bytes[1] === 0xfe)
            encoding = ENCODING_UTF_16LE
        else
            tl.debug('BOM no found: default to ascii.');

        tl.debug('encoding: ' + encoding);

        return encoding;
    }
    finally
    {
        fs.closeSync(fd);
    }
}

var replaceTokensInFile = function (filePath: string, regex: RegExp, encoding: string, keepToken: boolean, actionOnMissing: string, writeBOM): void {
    console.log('replacing tokens in: ' + filePath);

    // ensure encoding
    if (encoding === ENCODING_AUTO)
        encoding = getEncoding(filePath);

    // read file and replace tokens
    let content: string = iconv.decode(fs.readFileSync(filePath), encoding);
    content = content.replace(regex, (match, name) => {
        let value: string = tl.getVariable(name);

        if (!value)
        {
            if (keepToken)
                value = match;
            else
                value = '';

            let message = 'variable not found: ' + name;
            switch (actionOnMissing)
            {
                case ACTION_WARN:
                    tl.warning(message);
                    break;

                case ACTION_FAIL:
                    tl.setResult(tl.TaskResult.Failed, message);
                    break;

                default:
                    tl.debug(message);
            }
        }

        return value;
    });

    // write file
    fs.writeFileSync(filePath, iconv.encode(content, encoding, { addBOM: writeBOM, stripBOM: null, defaultEncoding: null }));
}

async function run() {
    try {
        // load inputs
        let root: string = tl.getPathInput('rootDirectory', false, true);
        let encoding: string = mapEncoding(tl.getInput('encoding', true));
        let tokenPrefix: string = tl.getInput('tokenPrefix', true).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let tokenSuffix: string = tl.getInput('tokenSuffix', true).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let keepToken: boolean = tl.getBoolInput('keepToken', true);
        let actionOnMissing: string = tl.getInput('actionOnMissing', true);
        let writeBOM: boolean = tl.getBoolInput('writeBOM', true);
        let targetFiles: string[] = tl.getDelimitedInput('targetFiles', '\n', true);

        // initialize task
        let regex: RegExp = new RegExp(tokenPrefix + '((?:(?!' + tokenSuffix + ').)*)' + tokenSuffix, 'gm');
        tl.debug('pattern: ' + regex.source);

        // process files
        targetFiles.forEach(pattern => {
            getMatchingFiles(pattern, root).forEach(filePath => {
                if (!tl.exist(filePath))
                {
                    tl.error('file not found: ' + filePath);

                    return;
                }

                replaceTokensInFile(filePath, regex, encoding, keepToken, actionOnMissing, writeBOM);
            });
        });
    }
    catch (err)
    {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();