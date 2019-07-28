var gulp = require('gulp');
var debug = require('gulp-debug');
var gutil = require('gulp-util');
var ts = require("gulp-typescript");
var path = require('path');
var shell = require('shelljs');
var minimist = require('minimist');
var semver = require('semver');
var fs = require('fs');
var del = require('del');
var merge = require('merge-stream');
var cp = require('child_process');

var _buildRoot = path.join(__dirname, '_artifacts', 'binaries');
var _packagesRoot = path.join(__dirname, '_artifacts', 'packages');

function errorHandler(err) {
    process.exit(1);
}

gulp.task('default', ['build']);

gulp.task('build', ['clean', 'compile'], function () {
    var extension = gulp.src(['README.md', 'LICENSE.txt', 'images/**/*', '!images/**/*.pdn', 'vss-extension.json'], { base: '.' })
        .pipe(debug({title: 'extension:'}))
        .pipe(gulp.dest(_buildRoot));
    var task = gulp.src(['task/**/*', '!task/**/*.ts'], { base: '.' })
        .pipe(debug({title: 'task:'}))
        .pipe(gulp.dest(_buildRoot));

    getExternalModules();
    
    return merge(extension, task);
});

gulp.task('clean', function() {
   return del([_buildRoot]);
});

gulp.task('compile', ['clean'], function() {
    var taskPath = path.join(__dirname, 'task', '*.ts');
    var tsConfigPath = path.join(__dirname, 'tsconfig.json');

    return gulp.src([taskPath], { base: './task' })
        .pipe(ts.createProject(tsConfigPath)())
        .on('error', errorHandler)
        .pipe(gulp.dest(path.join(_buildRoot, 'task')));
});

gulp.task('package', ['build'], function() {
    var args = minimist(process.argv.slice(2), {});
    var options = {
        version: args.ver,
        stage: args.stage,
        public: args.public,
        taskId: args.taskId
    }

    if (options.version) {
        if (options.version === 'auto') {
            var ref = new Date(2000, 1, 1);
            var now = new Date();
            var major = 2
            var minor = Math.floor((now - ref) / 86400000);
            var patch = Math.floor(Math.floor(now.getSeconds() + (60 * (now.getMinutes() + (60 * now.getHours())))) * 0.5)
            options.version = major + '.' + minor + '.' + patch
        }
        
        if (!semver.valid(options.version)) {
            throw new gutil.PluginError('package', 'Invalid semver version: ' + options.version);
        }
    }
    
    switch (options.stage) {
        case 'dev':
            options.taskId = '0664FF86-F509-4392-A33C-B2D9239B9AE5';
            options.public = false;
            break;
    }
    
    updateExtensionManifest(options);
    updateTaskManifest(options);
    
    shell.exec('tfx extension create --root "' + _buildRoot + '" --output-path "' + _packagesRoot +'"')
});

getExternalModules = function() {
    // copy package.json without dev dependencies
    var libPath = path.join(_buildRoot, 'task');

    var pkg = require('./package.json');
    delete pkg.devDependencies;

    fs.writeFileSync(path.join(libPath, 'package.json'), JSON.stringify(pkg, null, 4));

    // install modules
    var npmPath = shell.which('npm');

    shell.pushd(libPath);
    {
        var cmdline = '"' + npmPath + '" install';
        var res = cp.execSync(cmdline);
        gutil.log(res.toString());

        shell.popd();
    }

    fs.unlinkSync(path.join(libPath, 'package.json'));
    fs.unlinkSync(path.join(libPath, 'package-lock.json'));
}

updateExtensionManifest = function(options) {
    var manifestPath = path.join(_buildRoot, 'vss-extension.json')
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
}

updateTaskManifest = function(options) {
    var manifestPath = path.join(_buildRoot, 'task', 'task.json')
    var manifest = JSON.parse(fs.readFileSync(manifestPath));
    
    if (options.version) {
        manifest.version.Major = semver.major(options.version);
        manifest.version.Minor = semver.minor(options.version);
        manifest.version.Patch = semver.patch(options.version);
    }

    manifest.helpMarkDown = 'v' + manifest.version.Major + '.' + manifest.version.Minor + '.' + manifest.version.Patch + ' - ' + manifest.helpMarkDown;
    
    if (options.stage) {
        manifest.friendlyName = manifest.friendlyName + ' (' + options.stage

        if (options.version) {
            manifest.friendlyName = manifest.friendlyName + ' ' + options.version
        }

        manifest.friendlyName = manifest.friendlyName + ')'
    }
    
    if (options.taskId) {
        manifest.id = options.taskId
    }
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
}