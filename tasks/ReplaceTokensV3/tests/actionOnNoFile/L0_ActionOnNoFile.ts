import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', '..', 'index.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// variables

// inputs
tmr.setInput('enableTelemetry', 'false');
tmr.setInput('targetFiles', 'input.json');
tmr.setInput('writeBOM', 'true');
tmr.setInput('actionOnNoFiles', process.env['__actiononnofiles__']);

// sdk answers
let answers = {
    'checkPath': {},
    'findMatch': {
        'input.json': [],
    },
    'stats': {},
    'exist': {},
}

tmr.setAnswers(answers);

// act
tmr.run();