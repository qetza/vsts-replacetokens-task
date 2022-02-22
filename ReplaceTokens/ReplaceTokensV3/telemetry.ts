import crypto = require('crypto');
import url = require('url');
import http = require('http');
import https = require('https');

const instrumentationKey = '99bddd1b-7049-4f4a-b45c-5c6ffbb48a2e';
const preview = false;
const version = '3.5.0';
const sdkVersion = 'replacetokens:1.0.0';
const operationName = 'replacetokens';
const eventName = 'token.replaced';
const telemetryUrl = 'https://dc.services.visualstudio.com/v2/track';
const timeout = 3000;

export default function trackEvent(event: TelemetryEvent, proxyUrl?: string): string {
    try
    {
        // create event payload
        let operationId: string = crypto.randomBytes(16).toString('hex');
        let body = {
            name: 'Microsoft.ApplicationInsights.Dev.' + instrumentationKey + '.Event',
            time: new Date().toISOString(),
            iKey: instrumentationKey,
            tags: {
                'ai.application.ver': version,
                'ai.cloud.role': event.serverType,
                'ai.internal.sdkVersion': sdkVersion,
                'ai.operation.id': operationId,
                'ai.operation.name': operationName,
                'ai.operation.parentId': '|' + operationId,
                'ai.user.accountId': event.account,
                'ai.user.authUserId': event.pipeline
            },
            data: {
                baseType: 'EventData',
                baseData: {
                    ver: '2',
                    name: eventName,
                    properties: {
                        preview: preview,
                        pipelineType: event.pipelineType,
                        result: event.result,
                        tokenPrefix: event.tokenPrefix,
                        tokenSuffix: event.tokenSuffix,
                        pattern: event.pattern,
                        encoding: event.encoding,
                        keepToken: event.keepToken,
                        actionOnMissing: event.actionOnMissing,
                        writeBOM: event.writeBOM,
                        emptyValue: event.emptyValue,
                        escapeType: event.escapeType,
                        escapeChar: event.escapeChar,
                        charsToEscape: event.charsToEscape,
                        verbosity: event.verbosity,
                        variableFiles: event.variableFiles,
                        variableSeparator: event.variableSeparator,
                        rules: event.rules,
                        rulesWithInputWildcard: event.rulesWithInputWildcard,
                        rulesWithOutputPattern: event.rulesWithOutputPattern,
                        rulesWithNegativePattern: event.rulesWithNegativePattern,
                        duration: event.duration,
                        tokenReplaced: event.tokenReplaced,
                        tokenFound: event.tokenFound,
                        fileProcessed: event.fileProcessed,
                        useLegacyPattern: event.useLegacyPattern,
                        enableTransforms: event.enableTransforms,
                        transformPrefix: event.transformPrefix,
                        transformSuffix: event.transformSuffix,
                        transformPattern: event.transformPattern,
                        transformExecuted: event.transformExecuted,
                        defaultValue: event.defaultValue,
                        defaultValueReplaced: event.defaultValueReplaced,
                        actionOnNoFiles: event.actionOnNoFiles,
                        inlineVariables: event.inlineVariables,
                        enableRecursion: event.enableRecursion
                    }
                }
            }
        };

        // send event
        let telemetryUrlParsed = url.parse(telemetryUrl);
        let options = {
            method: 'POST',
            host: telemetryUrlParsed.hostname,
            port: telemetryUrlParsed.port,
            path: telemetryUrlParsed.pathname,
            withCredentials: false,
            timeout: timeout,
            headers: <{ [key: string]: string}>{
                'Content-Type': 'application/json'
            }
        };

        proxyUrl = proxyUrl || process.env['https_proxy'] || undefined;
        if (proxyUrl)
        {
            if (proxyUrl.indexOf('//') === 0)
                proxyUrl = 'http:' + proxyUrl

            let proxyUrlParsed = url.parse(proxyUrl);
            if (proxyUrlParsed.protocol === 'https:')
            {
                proxyUrl = undefined;
            }
            else
            {
                options = {...options,
                    host: proxyUrlParsed.hostname,
                    port: proxyUrlParsed.port || '80',
                    path: telemetryUrl,
                    headers: {...options.headers,
                        Host: telemetryUrlParsed.hostname
                    }
                }
            }
        }

        let request = proxyUrl 
            ? http.request(options)
            : https.request(options);

        request.setTimeout(timeout, () => {
            request.abort()
        });
        request.on('error', (e) => {});

        request.write(JSON.stringify(body));
        request.end();

        // return payload
        body.name = 'Microsoft.ApplicationInsights.Dev.*****.Event'
        body.iKey = '*****';

        return JSON.stringify(body);
    }
    catch
    {
    }
}

export interface TelemetryEvent {
  account: string,
  pipeline: string,
  pipelineType: string,
  serverType: string,
  result: string,
  tokenPrefix: string,
  tokenSuffix: string,
  pattern: string,
  encoding: string,
  keepToken: boolean,
  actionOnMissing: string,
  writeBOM: boolean,
  emptyValue: string,
  escapeType: string,
  escapeChar: string,
  charsToEscape: string,
  verbosity: string,
  variableFiles: number,
  variableSeparator: string,
  rules: number,
  rulesWithInputWildcard: number,
  rulesWithOutputPattern: number,
  rulesWithNegativePattern: number,
  duration: number;
  tokenReplaced: number;
  tokenFound: number;
  fileProcessed: number;
  useLegacyPattern: boolean;
  enableTransforms: boolean;
  transformPrefix: string;
  transformSuffix: string;
  transformPattern: string;
  transformExecuted: number;
  defaultValue: string;
  defaultValueReplaced: number;
  actionOnNoFiles: string;
  inlineVariables: number;
  enableRecursion: boolean;
}