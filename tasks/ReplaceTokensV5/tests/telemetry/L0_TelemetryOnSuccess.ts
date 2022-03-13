import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

const nock = require('nock');
const taskPath = path.join(__dirname, '..', '..', 'index.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// variables
process.env['var1'] = 'var1_value';

// inputs
tmr.setInput('enableTelemetry', 'true');
tmr.setInput('targetFiles', 'input.json');
tmr.setInput('writeBOM', 'true');

// http requests
nock('https://dc.services.visualstudio.com')
    .post('/v2/track')
    .reply(418);

// sdk answers
let answers = {
    'checkPath': {},
    'findMatch': {
        'input.json': [process.env['__inputpath__']],
    },
    'stats': {},
    'exist': {},
}
answers['stats'][process.env['__inputpath__']] = {
    'isDirectory': false
};
answers['exist'][process.env['__inputpath__']] = true;

tmr.setAnswers(answers);

// act
tmr.run();