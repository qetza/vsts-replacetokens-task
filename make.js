// parse command line options
var minimist = require('minimist');
var mopts = {
    string: [
        'task',
        'taskId',
        'iKey',
        'extensionId'
    ],
    boolean: [
        'public'
    ]
};

var options = minimist(process.argv, mopts);

// remove well-known parameters from argv before loading make
process.argv = options._;

// modules
var shell = require('shelljs');
var make = require('shelljs/make');
var path = require('path');
var utils = require('./make-utils.js');

// global paths
var sourceRootPath = path.join(__dirname, 'tasks');
var binariesPath = path.join(__dirname, '_artifacts', 'binaries');
var packagesPath = path.join(__dirname, '_artifacts', 'packages');

// add node modules .bin to path
var nodeBinPath = path.join(__dirname, 'node_modules', '.bin');
if (!utils.test('-d', nodeBinPath))
    fail('node modules bin not found.');

utils.addPath(nodeBinPath);

// tasks list
var tasks = options.task
    ? options.task.split(',')
    : ['ReplaceTokensV3', 'ReplaceTokensV4', 'ReplaceTokensV5'];

// make targets
target.clean = function () {
    utils.banner('clean');

    utils.log(`cleaning binaries '${binariesPath}'`);
    utils.rm('-Rf', binariesPath);
    utils.mkdir('-p', binariesPath);
}

target.build = function () {
    target.clean();

    tasks.forEach(taskName => {
        utils.banner(`build ${taskName}`);

        const taskPath = path.join(sourceRootPath, taskName);
        const outputPath = path.join(binariesPath, 'tasks', taskName);

        utils.mkdir('-p', outputPath);

        utils.buildTask(taskPath, outputPath);
        utils.copyTaskResources(taskPath, outputPath);

        utils.updateTaskMetadata(
            {
                public: options.public,
                taskId: !options.public 
                    ? options.taskId || '0664FF86-F509-4392-A33C-B2D9239B9AE5' 
                    : undefined,
                instrumentationKey: !options.public 
                    ? options.iKey || '6c5a849a-a333-4eee-9fd0-fa4597251c5c'
                    : undefined,
            },
            outputPath);
    });

    utils.banner('build extension');

    const extensionPath = path.join(__dirname);
    utils.copyExtensionResources(extensionPath, binariesPath);

    utils.updateExtensionMetadata(
        {
            public: options.public,
            extensionId: !options.public 
                ? options.extensionId
                : undefined,
        },
        binariesPath);
}

target.test = function () {
    tasks.forEach(taskName => {
        utils.banner(`test ${taskName}`);

        const testPath = path.join(binariesPath, 'tasks', taskName, 'tests');
        if (shell.test('-d', testPath))
            utils.testTask(testPath, 'L0');
    });
}

target.package = function () {
    utils.banner('package extension');

    utils.packageExtension(binariesPath, packagesPath);
}