import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const nock = require('nock');
const taskPath = path.join(__dirname, '..', '..', 'index.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// inputs
tmr.setInput('enableTelemetry', 'true');
tmr.setInput('rootDirectory', '/rootDirectory');

// http requests
nock('https://dc.services.visualstudio.com')
    .post('/v2/track')
    .reply(418);

// sdk answers
let answers = {
    'checkPath': {
        '/rootDirectory': true
    }
}
tmr.setAnswers(answers);

// act
tmr.run();