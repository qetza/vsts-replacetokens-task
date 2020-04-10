import crypto = require('crypto');

const instrumentationKey = '99bddd1b-7049-4f4a-b45c-5c6ffbb48a2e';
const preview = false;
const version = '3.5.0';
const sdkVersion = 'replacetokens:1.0.0';
const operationName = 'replacetokens';
const eventName = 'token.replaced'

export default function trackEvent(event: TelemetryEvent): string {
    try
    {
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
                        fileProcessed: event.fileProcessed
                    }
                }
            }
        };

        body.name = 'Microsoft.ApplicationInsights.Dev.*****.Event'
        body.iKey = '*****';
        return JSON.stringify(body);
    }
    catch
    {
        console.debug('error sending telemetry data.');
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
}