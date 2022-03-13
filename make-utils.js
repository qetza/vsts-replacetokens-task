var os = require('os');
var shell = require('shelljs');
var path = require('path');
var childprocess = require('child_process');
var fs = require('fs');
var semver = require('semver');

// shell helpers
var exec = function (command) {
    var r = command();

    var msg = shell.error();
    if (msg)
        throw new Error(msg.toString());
    
    return r;
}

var test = function (option, path) {
    return exec(() => shell.test(option, path));
}
exports.test = test;

var rm = function (options, files) {
    exec(() => shell.rm(options, files));
}
exports.rm = rm;

var mkdir = function (options, dir) {
    return exec(() => shell.mkdir(options, dir));
}
exports.mkdir = mkdir;

var pushd = function (options, dir) {
    exec(() => shell.pushd(options, dir));
}
exports.pushd = pushd;

var popd = function (options) {
    exec(() => shell.popd(options));
}
exports.popd = popd;

var cp = function (options, source, dest) {
    exec(() => shell.cp(options, source, dest));
}
exports.cp = cp;

var find = function(path) {
    return exec(() => shell.find(path));
}
exports.find = find;

// misc helpers
var addPath = function (directory) {
    log(`preprending PATH with '${directory}'`);

    var separator = os.platform() === 'win32'
        ? ';'
        : ':';

    var existingPath = process.env['PATH'];
    process['PATH'] = existingPath
        ? process.env['PATH'] = directory + separator + existingPath
        : directory;
}
exports.addPath = addPath;

var fail = function (message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}
exports.fail = fail;

var banner = function (message) {
    console.log('--------------------------------------------------');
    console.log(message);
    console.log('--------------------------------------------------');
}
exports.banner = banner;

var log = function (message) {
    console.log(`> ${message}`);
}
exports.log = log;

var run = function (command, inheritStreams) {
    log(command);

    var options = {
        stdio: inheritStreams ? 'inherit' : 'pipe'
    };

    var output;
    try {
        output = childprocess.execSync(command, options);
    }
    catch (err) {
        if (!inheritStreams) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        process.exit(1);
    }

    return (output || '').toString().trim();
}
exports.run = run;

var fileToJson = function (file) {
    var json = JSON.parse(fs.readFileSync(file).toString());

    return json;
}

var jsonToFile = function(json, file) {
    fs.writeFileSync(file, JSON.stringify(json, null, 4));
}

// build
var buildTask = function (taskPath, outputPath) {
    pushd('-q', taskPath);

    try {
        // paths
        const taskPackagePath = path.join(pwd() + '', 'package.json');
        const testPackagePath = path.join(pwd() + '', 'tests', 'package.json');

        // restore node modules
        if (test('-f', taskPackagePath)) {
            log(`restoring modules '${taskPackagePath}'`);

            run('npm install');
        }

        if (test('-f', testPackagePath)) {
            log(`restoring modules '${testPackagePath}'`);

            pushd('-q', path.join(pwd() + '', 'tests'));
            try {
                run('npm install');
            }
            finally {
                popd('-q');
            }
        }

        // build task
        run(`tsc --outDir "${outputPath}" --rootDir "${taskPath}"`);
    }
    finally {
        popd('-q');
    }
}
exports.buildTask = buildTask;

var copyTaskResources = function (taskPath, outputPath) {
    const resources = [
        'icon.png',
        'node_modules',
        'task.json',
        'tests'
    ];

    resources.forEach(pattern => {
        const sourcePath = path.join(taskPath, pattern);

        if (test('-d', sourcePath) || test('-f', sourcePath)) {
            log(`copying '${pattern}'`);

            cp('-Rf', sourcePath, outputPath + '/');
        }
    });
}
exports.copyTaskResources = copyTaskResources;

var updateTaskMetadata = function (options, taskPath) {
    const manifestPath = path.join(taskPath, 'task.json');
    var manifest = fileToJson(manifestPath);

    options.version = options.public 
        ? `${manifest.version.Major}.${manifest.version.Minor}.${manifest.version.Patch}`
        : generateVersion(manifest, manifest.version.Major);

    updateTaskManifest(manifest, options);

    jsonToFile(manifest, manifestPath);

    const telemetryPath = path.join(taskPath, 'telemetry.js');
    updateTaskTelemetry(
        telemetryPath, 
        {
            version: options.version, 
            instrumentationKey: options.instrumentationKey 
        });
}
exports.updateTaskMetadata = updateTaskMetadata;

var minor = null;
var patch = null;
var generateVersion = function (manifest, major) {
    const ref = new Date(2000, 1, 1);
    const now = new Date();
    minor = minor || Math.floor((now - ref) / 86400000);
    patch = patch || Math.floor(Math.floor(now.getSeconds() + (60 * (now.getMinutes() + (60 * now.getHours())))) * 0.5)

    return `${major}.${minor}.${patch}`
}

var updateTaskManifest = function (manifest, options) {
    log(`updating task version '${options.version}'`);

    manifest.version.Major = semver.major(options.version);
    manifest.version.Minor = semver.minor(options.version);
    manifest.version.Patch = semver.patch(options.version);
    manifest.helpMarkDown = `${manifest.helpMarkDown} (v${options.version})`;

    if (!options.public) {
        log('updating task as dev');

        manifest.friendlyName = `${manifest.friendlyName} (dev ${options.version})`;
    }

    if (options.taskId) {
        log(`updating task id '${options.taskId}'`);

        manifest.id = options.taskId;
    }
};

var updateTaskTelemetry = function (telemetryPath, options) {
    var script = fs.readFileSync(telemetryPath, { encoding: 'utf8' });

    if (options.instrumentationKey)
    {
        log(`updating telemetry instrumentation key '${options.instrumentationKey}'`);

        script = script.replace(/const\s+instrumentationKey\s*=\s*'[^']*'\s*;/, `const instrumentationKey = '${options.instrumentationKey}';`);
    }

    log(`updating telemetry version '${options.version}'`);

    script = script.replace(/const\s+version\s*=\s*'[^']*'\s*;/, `const version = '${options.version}';`);

    fs.writeFileSync(telemetryPath, script);
}

var copyExtensionResources = function (extensionPath, outputPath) {
    const resources = [
        '*.md',
        '*.txt',
        'vss-extension.json',
        'images/*.png'
    ];

    resources.forEach(pattern => {
        const sourcePath = path.join(extensionPath, pattern);

        //if (test('-d', sourcePath) || test('-f', sourcePath))
        {
            log(`copying '${pattern}'`);

            var dest = pattern.indexOf('/') < 0
                ? outputPath
                : path.join(outputPath, pattern.substring(0, pattern.lastIndexOf('/')));

            if (!test('-d', dest))
                mkdir('-p', dest);

            cp('-Rf', sourcePath, dest);
        }
    });
}
exports.copyExtensionResources = copyExtensionResources;

var updateExtensionMetadata = function (options, extensionPath) {
    const manifestPath = path.join(extensionPath, 'vss-extension.json');
    var manifest = fileToJson(manifestPath);

    if (options.extensionId) {
        log(`updating extension id '${options.extensionId}'`);

        manifest.id = options.extensionId;
    }

    options.version = options.public 
        ? manifest.version
        : generateVersion(manifest, semver.major(manifest.version));

    log(`updating extension version '${options.version}'`);
    manifest.version = options.version;

    if (!options.public) {
        log('updating extension as dev');

        manifest.id = `${manifest.id}-dev`;
        manifest.name = `${manifest.name} (dev)`;
    }

    log(`updating extension visibility '${options.public}'`);

    manifest.public = options.public;

    jsonToFile(manifest, manifestPath);
}
exports.updateExtensionMetadata = updateExtensionMetadata;

// test
var testTask = function (testPath, suite) {
    pushd('-q', testPath);

    try {
        // paths
        const suitePath = path.join(testPath, `${suite}.js`);

        if (!test('-f', suitePath))
            fail(`test suite '${suitePath}' not found.`);

        // run tests
        run(`mocha ${suitePath}`, true);
    }
    finally {
        popd('-q');
    }
}
exports.testTask = testTask;

// package
var packageExtension = function (extensionPath, outputPath) {
    // copy build output and remove tests
    log('copying build output without tests')

    const tmpPath = path.join(outputPath, 'tmp');
    mkdir('-p', tmpPath);

    cp('-Rf', path.join(extensionPath, '*'), tmpPath);

    find(tmpPath).filter(file => file.match(/\/ReplaceTokensV\d+\/tests$/)).forEach(file => {
        rm('-Rf', file);
    });

    try {
        // create extension
        run(`tfx extension create --root "${tmpPath}" --output-path "${outputPath}"`);
    }
    finally {
        // clean tmp
        if (test('-d', tmpPath)) {
            log('removing tmp');

            rm('-Rf', tmpPath);
        }
    }
}
exports.packageExtension = packageExtension;