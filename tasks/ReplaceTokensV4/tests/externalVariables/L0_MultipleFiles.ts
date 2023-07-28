import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', '..', 'index.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// inputs
tmr.setInput('enableTelemetry', 'false');
tmr.setInput('targetFiles', 'input.json');
tmr.setInput('writeBOM', 'true');
tmr.setInput('variableFiles', "variables1.ext\nvariables2.ext");

// sdk answers
let answers = {
    'checkPath': {},
    'findMatch': {
        'input.json': [process.env['__inputpath__']],
        'variables1.ext': [process.env['__variablespath1__']],
        'variables2.ext': [process.env['__variablespath2__']],
    },
    'stats': {},
    'exist': {},
}
answers['stats'][process.env['__inputpath__']] = {
    'isDirectory': false
};
answers['stats'][process.env['__variablespath1__']] = {
    'isDirectory': false
};
answers['stats'][process.env['__variablespath2__']] = {
    'isDirectory': false
};
answers['exist'][process.env['__inputpath__']] = true;
answers['exist'][process.env['__variablespath1__']] = true;
answers['exist'][process.env['__variablespath2__']] = true;

tmr.setAnswers(answers);

// act
tmr.run();