// parse command line options
var minimist = require('minimist');
var mopts = {
    string: [
        'version',
        'stage',
        'taskId',
        'iKey'
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
var os = require('os');
var cp = require('child_process');
var fs = require('fs');
var semver = require('semver');

// global paths
var sourceRootPath = path.join(__dirname, 'ReplaceTokens');
var binariesPath = path.join(__dirname, '_artifacts', 'binaries');
var packagesPath = path.join(__dirname, '_artifacts', 'packages');

// add node modules .bin to path
var binPath = path.join(__dirname, 'node_modules', '.bin');
var separator = os.platform() === 'win32' ? ';' : ':';
var existing = process.env['PATH'];

if (existing)
    process.env['PATH'] = binPath + separator + existing;
else
    process.env['PATH'] = binPath;

// make targets
target.clean = function() {
    console.log('clean: cleaning binaries');

    shell.rm('-Rf', binariesPath);
    shell.mkdir('-p', binariesPath);
}

target.build = function() {
    target.clean();

    // update options
    switch (options.stage) {
        case 'dev':
            options.taskId = '0664FF86-F509-4392-A33C-B2D9239B9AE5';
            options.iKey = '6c5a849a-a333-4eee-9fd0-fa4597251c5c';
            options.public = false;
            break;
    }

    // build tasks
    buildTask(3);
    buildTask(4);

    // copy extension resources
    console.log('build: copying extension resources');

    ['README.md', 'LICENSE.txt', 'vss-extension.json'].forEach(function(file) {
        shell.cp('-Rf', path.join(__dirname, file), binariesPath);
        console.log('  ' + file + ' -> ' + path.join(binariesPath, file));
    });

    var imagesPath = path.join(binariesPath, 'images')
    shell.mkdir('-p', imagesPath);
    shell.cp('-Rf', path.join(__dirname, 'images', '*.png'), imagesPath);
    console.log('  images -> ' + imagesPath);

    // versioning
    var extensionOptions = {
        version: options.version,
        stage: options.stage,
        taskId: options.taskId,
        public: options.public
    };
    extensionOptions.version = computeVersion(extensionOptions.version, 4);

    var extensionVersion = updateExtensionManifest(path.join(binariesPath, 'vss-extension.json'), extensionOptions);
    console.log('  version -> ' + extensionVersion);
}

var minor = null;
var patch = null;
computeVersion = function(version, majorVersion) {
    if (version) {
        if (version === 'auto') {
            var ref = new Date(2000, 1, 1);
            var now = new Date();
            var major = majorVersion
            minor = minor || Math.floor((now - ref) / 86400000);
            patch = patch || Math.floor(Math.floor(now.getSeconds() + (60 * (now.getMinutes() + (60 * now.getHours())))) * 0.5)
            version = major + '.' + minor + '.' + patch
        }
        
        if (!semver.valid(version)) {
            console.error('build', 'Invalid semver version: ' + version);
            process.exit(1);
        }
    }

    return version;
}

buildTask = function(majorVersion) {
    // paths
    var sourcePath = path.join(sourceRootPath, 'ReplaceTokensV' + majorVersion);
    var outputPath = path.join(binariesPath, 'ReplaceTokens', 'ReplaceTokensV' + majorVersion);
    var npmPath = shell.which('npm');

    // restore modules
    console.log('build: restoring modules v' + majorVersion);

    shell.pushd('-q', sourcePath);
    cp.execSync('"' + npmPath + '" install', { stdio: ['pipe', 'ignore', 'pipe'] });
    shell.popd('-q');
    console.log('  modules -> ' + path.join(sourcePath, 'node_modules'))

    // build task
    console.log('build: building task v' + majorVersion);

    shell.exec('tsc --project ' + path.join(sourcePath, 'tsconfig.json') + ' --outDir ' + outputPath + ' --rootDir ' + sourcePath);
    console.log('  task -> ' + outputPath);

    shell.cp('-Rf', path.join(sourcePath, 'node_modules'), path.join(outputPath, 'node_modules'));
    console.log('  modules -> ' + path.join(outputPath, 'node_modules'));

    shell.cp('-Rf', path.join(sourcePath, '*.png'), outputPath);
    shell.cp('-Rf', path.join(sourcePath, 'task.json'), outputPath);
    console.log('  resources -> ' + outputPath);

    // versioning
    var taskOptions = {
        version: options.version,
        stage: options.stage,
        taskId: options.taskId
    };
    taskOptions.version = computeVersion(taskOptions.version, majorVersion);

    var taskVersion = updateTaskManifest(path.join(outputPath, 'task.json'), taskOptions);
    updateTelemetryScript(path.join(outputPath, 'telemetry.js'), options.iKey, taskVersion);

    console.log('  version -> ' + taskVersion);
}

target.package = function() {
    console.log('package: packaging extension');

    shell.exec('tfx extension create --root "' + binariesPath + '" --output-path "' + packagesPath +'"')
}

updateExtensionManifest = function(manifestPath, options) {
    var manifest = JSON.parse(fs.readFileSync(manifestPath));
    
    if (options.version) {
        manifest.version = options.version;
    }
    
    if (options.stage) {
        manifest.id = manifest.id + '-' + options.stage
        manifest.name = manifest.name + ' (' + options.stage + ')'
    }

    manifest.public = options.public;
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

    return manifest.version;
}

updateTaskManifest = function(manifestPath, options) {
    var manifest = JSON.parse(fs.readFileSync(manifestPath));
    
    if (options.version) {
        manifest.version.Major = semver.major(options.version);
        manifest.version.Minor = semver.minor(options.version);
        manifest.version.Patch = semver.patch(options.version);
    }

    manifest.helpMarkDown = manifest.helpMarkDown + ' (v' + manifest.version.Major + '.' + manifest.version.Minor + '.' + manifest.version.Patch + ')';
    
    if (options.stage) {
        manifest.friendlyName = manifest.friendlyName + ' (' + options.stage;

        if (options.version) {
            manifest.friendlyName = manifest.friendlyName + ' ' + options.version;
        }

        manifest.friendlyName = manifest.friendlyName + ')'
    }
    
    if (options.taskId) {
        manifest.id = options.taskId;
    }
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

    return manifest.version.Major + '.' + manifest.version.Minor + '.' + manifest.version.Patch;
}

updateTelemetryScript = function(scriptPath, instrumentationKey, taskVersion) {
    var script = fs.readFileSync(scriptPath, { encoding: 'utf8' });

    if (instrumentationKey)
        script = script.replace(/const\s+instrumentationKey\s*=\s*'[^']*'\s*;/, "const instrumentationKey = '" + instrumentationKey + "';");

    if (taskVersion)
        script = script.replace(/const\s+version\s*=\s*'[^']*'\s*;/, "const version = '" + taskVersion + "';");

    fs.writeFileSync(scriptPath, script);
}