import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', '..', 'index.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// variables
process.env['var1'] = 'var1_value';
process.env['var2_0'] = 'var2';
process.env['var2_1'] = 'value';

// inputs
tmr.setInput('enableTelemetry', 'false');
tmr.setInput('targetFiles', 'input1.json\ninput2.json');
tmr.setInput('writeBOM', 'true');
tmr.setInput('enableRecursion', 'true');
tmr.setInput('useLegacyEmptyFeature', 'false');
tmr.setInput('useDefaultValue', 'true');
tmr.setInput('defaultValue', '[default]');
tmr.setInput('enableTransforms', 'true');

// sdk answers
let answers = {
    'checkPath': {},
    'findMatch': {
        'input1.json': [process.env['__inputpath1__']],
        'input2.json': [process.env['__inputpath2__']],
    },
    'stats': {},
    'exist': {},
}
answers['stats'][process.env['__inputpath1__']] = {
    'isDirectory': false
};
answers['stats'][process.env['__inputpath2__']] = {
    'isDirectory': false
};
answers['exist'][process.env['__inputpath1__']] = true;
answers['exist'][process.env['__inputpath2__']] = true;

tmr.setAnswers(answers);

// act
tmr.run();