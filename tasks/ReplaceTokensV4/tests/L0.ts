import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import chai = require('chai');
var should = chai.should();

import crypto = require('crypto');

describe('ReplaceTokens v4 L0 suite', function() {
    this.timeout(5000);

    function runValidation(validator, tr, done) {
        try {
            validator();
            done();
        }
        catch (err) {
            console.log('STDERR');
            console.log(tr.stderr);
            console.log('STDOUT');
            console.log(tr.stdout);

            done(err);
        }
    };

    function removeFolder(p) {
        if (fs.existsSync(p)) {
            fs.readdirSync(p).forEach((file, index) => {
                const newPath = path.join(p, file);
                if (fs.lstatSync(newPath).isDirectory())
                    removeFolder(newPath);
                else
                    fs.unlinkSync(newPath);
                });
            fs.rmdirSync(p);
        }
    }

    before(() => {
        process.env['system_servertype'] = 'server';
        process.env['system_collectionid'] = 'col01';
        process.env['system_teamprojectid'] = 'project01';
        process.env['system_definitionid'] = 'def01';

        const testTmpPath = path.join(__dirname, 'test_tmp');
        if (fs.existsSync(testTmpPath))
            removeFolder(testTmpPath);
        fs.mkdirSync(testTmpPath);
    });

    this.afterEach(() => {
        // clean env
        delete process.env['__inputpath__']
        delete process.env['__inputpath1__']
        delete process.env['__inputpath2__']
        delete process.env['__outputpath__']
        delete process.env['__input__']
        delete process.env['__tokenpattern__']
        delete process.env['__keeptoken__']
        delete process.env['var1']
        delete process.env['__actiononmissing__']
        delete process.env['__verbosity__']
        delete process.env['__escapetype__'];
        delete process.env['__actiononnofiles__'];
        delete process.env['__defaultvalue__'];
        delete process.env['__usedefaultvalue__'];
    });

    describe('#telemetry', function() {
        it('should not call telemetry when disabled by input', function(done: Mocha.Done) {
            // arrange
            let tp: string = path.join(__dirname, 'telemetry', 'L0_TelemetryDisabledByInput.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.stdout.should.not.include('sent usage telemetry:');
                },
                tr,
                done);
        });

        it('should not call telemetry when disabled by variable', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'telemetry', 'L0_TelemetryDisabledByVariable.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.stdout.should.not.include('sent usage telemetry:');
                },
                tr,
                done);
        });

        it('should call telemetry on failure', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'telemetry', 'L0_TelemetryOnFailure.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(false, 'task succeeded');
                    tr.stdout.should.match(
                        /{\\"name\\":\\"Microsoft\.ApplicationInsights\.Dev\.\*+\.Event\\",\\"time\\":\\"[^"]+\\",\\"iKey\\":\\"\*+\\",\\"tags\\":{\\"ai\.application\.ver\\":\\"4\.\d+\.\d+\\",\\"ai\.cloud\.role\\":\\"server\\",\\"ai\.internal\.sdkVersion\\":\\"replacetokens:1\.0\.0\\",\\"ai\.operation\.id\\":\\"([^"]+)\\",\\"ai\.operation\.name\\":\\"replacetokens\\",\\"ai\.operation\.parentId\\":\\"\|\1\\",\\"ai\.user\.accountId\\":\\"494d0aad9d06c4ddb51d5300620122ce55366a9382b3cc2835ed5f0e2e67b4d0\\",\\"ai\.user\.authUserId\\":\\"b98ed03d3eec376dcc015365c1a944e3ebbcc33d30e3261af3f4e4abb107aa82\\"},\\"data\\":{\\"baseType\\":\\"EventData\\",\\"baseData\\":{\\"ver\\":\\"2\\",\\"name\\":\\"token\.replaced\\",\\"properties\\":{\\"preview\\":false,\\"pipelineType\\":\\"build\\",\\"result\\":\\"failed\\"}}}}/g);
                },
                tr,
                done);
        });

        it('should call telemetry on success', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'telemetry', 'L0_TelemetryOnSuccess.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_telemetryonsuccess.json');
            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');
                    tr.stdout.should.match(
                        /{\\"name\\":\\"Microsoft\.ApplicationInsights\.Dev\.\*+\.Event\\",\\"time\\":\\"[^"]+\\",\\"iKey\\":\\"\*+\\",\\"tags\\":{\\"ai\.application\.ver\\":\\"4\.\d+\.\d+\\",\\"ai\.cloud\.role\\":\\"server\\",\\"ai\.internal\.sdkVersion\\":\\"replacetokens:1\.0\.0\\",\\"ai\.operation\.id\\":\\"([^"]+)\\",\\"ai\.operation\.name\\":\\"replacetokens\\",\\"ai\.operation\.parentId\\":\\"\|\1\\",\\"ai\.user\.accountId\\":\\"494d0aad9d06c4ddb51d5300620122ce55366a9382b3cc2835ed5f0e2e67b4d0\\",\\"ai\.user\.authUserId\\":\\"b98ed03d3eec376dcc015365c1a944e3ebbcc33d30e3261af3f4e4abb107aa82\\"},\\"data\\":{\\"baseType\\":\\"EventData\\",\\"baseData\\":{\\"ver\\":\\"2\\",\\"name\\":\\"token\.replaced\\",\\"properties\\":{\\"preview\\":false,\\"pipelineType\\":\\"build\\",\\"result\\":\\"succeeded\\",\\"tokenPrefix\\":\\"#{\\",\\"tokenSuffix\\":\\"}#\\",\\"pattern\\":\\"#\\\\\\\\{\\\\\\\\s\*\(\(\?:\(\?!#\\\\\\\\{\)\(\?!\\\\\\\\s\*\\\\\\\\}#\)\.\)\*\)\\\\\\\\s\*\\\\\\\\}#\\",\\"encoding\\":\\"auto\\",\\"keepToken\\":false,\\"actionOnMissing\\":\\"warn\\",\\"writeBOM\\":true,\\"verbosity\\":\\"normal\\",\\"variableFiles\\":0,\\"rules\\":1,\\"rulesWithInputWildcard\\":0,\\"rulesWithOutputPattern\\":0,\\"rulesWithNegativePattern\\":0,\\"duration\\":\d+(?:\.\d+)?,\\"tokenReplaced\\":1,\\"tokenFound\\":1,\\"fileProcessed\\":1,\\"useLegacyPattern\\":false,\\"enableTransforms\\":false,\\"transformPrefix\\":\\"\(\\",\\"transformSuffix\\":\\"\)\\",\\"transformPattern\\":\\"\\\\\\\\s\*\(\.\*\)\\\\\\\\\(\\\\\\\\s\*\(\(\?:\(\?!\\\\\\\\\(\)\(\?!\\\\\\\\s\*\\\\\\\\\)\)\.\)\*\)\\\\\\\\s\*\\\\\\\\\)\\\\\\\\s\*\\",\\"transformExecuted\\":0,\\"defaultValue\\":\\"\\",\\"defaultValueReplaced\\":0,\\"tokenPattern\\":\\"default\\",\\"actionOnNoFiles\\":\\"continue\\",\\"inlineVariables\\":0,\\"enableRecursion\\":false,\\"useLegacyEmptyFeature\\":false,\\"useDefaultValue\\":false}}}}/g);
                },
                tr,
                done);
        });
    });

    describe('#target files', function() {
        it('should replace inline when no output path', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'targetFiles', 'L0_InlineReplace.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_inlinereplace.json');
            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace multiple inline when no output path', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'targetFiles', 'L0_MultipleInlineReplace.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath1__'] = path.join(__dirname, 'test_tmp', 'default_inlinereplace1.json');
            process.env['__inputpath2__'] = path.join(__dirname, 'test_tmp', 'default_inlinereplace2.json');
            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath1__']);
            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath2__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');

                    let actual: string = fs.readFileSync(process.env['__inputpath1__'], 'utf8');
                    actual.should.equal(expected, 'replaced output in first file');

                    actual = fs.readFileSync(process.env['__inputpath2__'], 'utf8');
                    actual.should.equal(expected, 'replaced output in second file');
                },
                tr,
                done);
        });

        it('should replace in other file when relative output path', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'targetFiles', 'L0_OutputReplace.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_relativeoutputreplace.json');
            process.env['__outputpath__'] = path.join('output', 'default_relativeoutputreplace.output.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(path.join(__dirname, 'test_tmp', process.env['__outputpath__']), 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');

                    let input: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let original: string = fs.readFileSync(dataPath, 'utf8');
                    input.should.equal(original, 'input');
                },
                tr,
                done);
        });

        it('should replace in other file when absolute output path', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'targetFiles', 'L0_OutputReplace.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_absoluteoutputreplace.json');
            process.env['__outputpath__'] = path.join(__dirname, 'test_tmp', 'output', 'default_absoluteoutputreplace.output.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__outputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');

                    let input: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let original: string = fs.readFileSync(dataPath, 'utf8');
                    input.should.equal(original, 'input');
                },
                tr,
                done);
        });

        it('should replace in other file when wildcard and output path', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'targetFiles', 'L0_WildcardReplace.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__input__'] = 'default_wildcardreplace.*.json';
            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_wildcardreplace.dev.json');
            process.env['__outputpath__'] = path.join('output', 'default_wildcardreplace.*.output.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(path.join(__dirname, 'test_tmp', 'output', 'default_wildcardreplace.dev.output.json'), 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');

                    let input: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let original: string = fs.readFileSync(dataPath, 'utf8');
                    input.should.equal(original, 'input');
                },
                tr,
                done);
        });
    });

    describe('#token pattern', function() {
        it('should replace when default pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_TokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_defaulttokenpattern.json');
            process.env['__tokenpattern__'] = 'default';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace when rm pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_TokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_rmtokenpattern.json');
            process.env['__tokenpattern__'] = 'rm';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.rm.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace when octopus pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_TokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_octopustokenpattern.json');
            process.env['__tokenpattern__'] = 'octopus';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.octopus.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace when azpipelines pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_TokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_azpipelinestokenpattern.json');
            process.env['__tokenpattern__'] = 'azpipelines';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.azpipelines.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace when doublebraces pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_TokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_doublebracestokenpattern.json');
            process.env['__tokenpattern__'] = 'doublebraces';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.doublebraces.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace when custom pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_CustomTokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_customtokenpattern.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.custom.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace when legacy pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_LegacyTokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_legacytokenpattern.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should no replace when legacy pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'tokenPattern', 'L0_LegacyTokenPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_newtokenpattern.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.newpattern.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_noreplace.json'), 'utf8');
                    actual.should.equal(expected, 'output');
                },
                tr,
                done);
        });
    });

    describe('#keep token', function() {
        it('should replace with empty when not keeping token', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'keepToken', 'L0_KeepToken.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_nokeeptoken.json');
            process.env['__keeptoken__'] = 'false';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_noreplace.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace with token when keeping token', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'keepToken', 'L0_KeepToken.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_nokeeptoken.json');
            process.env['__keeptoken__'] = 'true';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(dataPath, 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });
    });

    describe('#transforms', function() {
        it('should uppercase replaced value with transform', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'transforms', 'L0_TransformValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'transform_upper.json');
            process.env['var1'] = 'var1_value';

            let dataPath: string = path.join(__dirname, 'test_data', 'transform.upper.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'transform.upper.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should lowercase replaced value with transform', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'transforms', 'L0_TransformValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'transform_lower.json');
            process.env['var1'] = 'VAR1_VALUE';

            let dataPath: string = path.join(__dirname, 'test_data', 'transform.lower.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'transform.lower.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should base64 replaced value with transform', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'transforms', 'L0_TransformValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'transform_base64.json');
            process.env['var1'] = 'var1_value';

            let dataPath: string = path.join(__dirname, 'test_data', 'transform.base64.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'transform.base64.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should not escape replaced value with transform', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'transforms', 'L0_TransformValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'transform_noescape.json');
            process.env['var1'] = '"var1_value"';

            let dataPath: string = path.join(__dirname, 'test_data', 'transform.noescape.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'transform.noescape.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should transform replaced value with custom transform pattern', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'transforms', 'L0_TransformPattern.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'transform_custom.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'transform.custom.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'transform.upper.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });
    });

    describe('#action on missing', function() {
        it('should display information on missing value when continue silently', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'actionOnMissing', 'L0_ActionOnMissing.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_continuemissingvar.json');
            process.env['__actiononmissing__'] = 'continue';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.debug]  variable not found: var1');
                },
                tr,
                done);
        });

        it('should display warn on missing value when warning', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'actionOnMissing', 'L0_ActionOnMissing.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_warnmissingvar.json');
            process.env['__actiononmissing__'] = 'warn';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.issue type=warning;]  variable not found: var1');
                },
                tr,
                done);
        });

        it('should fail on missing value when fail', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'actionOnMissing', 'L0_ActionOnMissing.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_failmissingvar.json');
            process.env['__actiononmissing__'] = 'fail';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(false, 'task succeeded');

                    tr.stdout.should.include('##vso[task.issue type=error;]  variable not found: var1');
                },
                tr,
                done);
        });
    });

    describe('#logs', function() {
        it('should log minimal when normal', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'logs', 'L0_Verbosity.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_normalverbosity.json');
            process.env['__verbosity__'] = 'normal';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##[group]replacing tokens in: ' + process.env['__inputpath__']);
                    tr.stdout.should.not.include('\n  using encoding: ascii');
                    tr.stdout.should.not.include('\n  var1: var1_value');
                    tr.stdout.should.include('1 token(s) replaced out of 1');

                    tr.stdout.should.include('replaced 1 tokens out of 1 in 1 file(s)');
                },
                tr,
                done);
        });

        it('should log all when detailed', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'logs', 'L0_Verbosity.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_detailedverbosity.json');
            process.env['__verbosity__'] = 'detailed';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##[group]replacing tokens in: ' + process.env['__inputpath__']);
                    tr.stdout.should.include('\n  using encoding: ascii');
                    tr.stdout.should.include('\n  var1: var1_value');
                    tr.stdout.should.include('1 token(s) replaced out of 1');

                    tr.stdout.should.include('replaced 1 tokens out of 1 in 1 file(s)');
                },
                tr,
                done);
        });

        it('should not log when off', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'logs', 'L0_Verbosity.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_offverbosity.json');
            process.env['__verbosity__'] = 'off';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.not.include('##[group]replacing tokens in: ' + process.env['__inputpath__']);
                    tr.stdout.should.not.include('\n  using encoding: ascii');
                    tr.stdout.should.not.include('\n  var1: var1_value');
                    tr.stdout.should.not.include('1 token(s) replaced out of 1');

                    tr.stdout.should.not.include('replaced 1 tokens out of 1 in 1 file(s)');
                },
                tr,
                done);
        });

        it('should log summary when replaced', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'logs', 'L0_Logs.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath1__'] = path.join(__dirname, 'test_tmp', 'default_logs1.json');
            process.env['__inputpath2__'] = path.join(__dirname, 'test_tmp', 'default_logs2.json');

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'logs.json'), 
                process.env['__inputpath1__']);
            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'logs.json'), 
                process.env['__inputpath2__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('replaced 8 tokens out of 8 (using 2 default value(s)) and running 2 functions in 2 file(s)');

                    tr.stdout.should.include('##vso[task.setvariable variable=tokenReplacedCount;isOutput=false;issecret=false;]8');
                    tr.stdout.should.include('##vso[task.setvariable variable=tokenFoundCount;isOutput=false;issecret=false;]8');
                    tr.stdout.should.include('##vso[task.setvariable variable=fileProcessedCount;isOutput=false;issecret=false;]2');
                    tr.stdout.should.include('##vso[task.setvariable variable=transformExecutedCount;isOutput=false;issecret=false;]2');
                    tr.stdout.should.include('##vso[task.setvariable variable=defaultValueCount;isOutput=false;issecret=false;]2');
                },
                tr,
                done);
        });
    });

    describe('#escape characters', function() {
        it('should escape json when auto on .json', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'escapeChars', 'L0_EscapeType.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_autoescape.json');
            process.env['__escapetype__'] = 'auto';
            process.env['var1'] = '"var\\1\n\r\tvalue\b\f';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_escape.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should escape xml when auto on .xml', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'escapeChars', 'L0_EscapeType.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_autoescape.xml');
            process.env['__escapetype__'] = 'auto';
            process.env['var1'] = '"var\'1&<value>';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.xml'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_escape.xml'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should not escape when none', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'escapeChars', 'L0_EscapeType.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_noneescape.json');
            process.env['__escapetype__'] = 'none';
            process.env['var1'] = '"var\\1\n\r\tvalue\b\f';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_noescape.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should escape json when json', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'escapeChars', 'L0_EscapeType.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_jsonescape.config');
            process.env['__escapetype__'] = 'json';
            process.env['var1'] = '"var\\1\n\r\tvalue\b\f';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default_json.config'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_escape.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should escape xml when xml', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'escapeChars', 'L0_EscapeType.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_xmlescape.config');
            process.env['__escapetype__'] = 'xml';
            process.env['var1'] = '"var\'1&<value>';

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default_xml.config'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_escape.xml'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should escape custom when custom', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'escapeChars', 'L0_CustomEscapeType.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_customescape.json');

            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'default.json'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_customescape.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });
    });

    describe('#action on no file', function() {
        it('should display information on no file when continue silently', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'actionOnNoFile', 'L0_ActionOnNoFile.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__actiononnofiles__'] = 'continue';

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('replaced 0 tokens out of 0 in 0 file(s)');
                },
                tr,
                done);
        });

        it('should display warn on no file when warn', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'actionOnNoFile', 'L0_ActionOnNoFile.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__actiononnofiles__'] = 'warn';

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.issue type=warning;]found no files to process');
                },
                tr,
                done);
        });

        it('should fail on no file when fail', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'actionOnNoFile', 'L0_ActionOnNoFile.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__actiononnofiles__'] = 'fail';

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(false, 'task succeeded');

                    tr.stdout.should.include('##vso[task.issue type=error;]found no files to process');
                },
                tr,
                done);
        });
    });

    describe('#empty value', function() {
        it('should replace empty value when legacy', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'emptyValue', 'L0_LegacyEmptyValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_legacyempty.json');
            process.env['var1'] = '';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.not.include('##vso[task.debug]  variable not found: var1');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_empty.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace empty value when new', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'emptyValue', 'L0_EmptyValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_empty.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.not.include('##vso[task.debug]  variable not found: var1');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_empty.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should not replace empty value when new and empty token', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'emptyValue', 'L0_EmptyValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_empty.json');
            process.env['var1'] = '(empty)';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.not.include('##vso[task.debug]  variable not found: var1');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_emptytoken.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });
    });

    describe('#default value', function() {
        it('should not replace when legacy and no default', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'defaultValue', 'L0_LegacyDefaultValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_legacynodefault.json');
            process.env['__defaultvalue__'] = '';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.issue type=warning;]  variable not found: var1');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_noreplace.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace with default when legacy and default', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'defaultValue', 'L0_LegacyDefaultValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_legacydefault.json');
            process.env['__defaultvalue__'] = '[default]';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.debug]  var1: [default] (default value)');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_default.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace with empty when legacy and empty default', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'defaultValue', 'L0_LegacyDefaultValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_legacyemptydefault.json');
            process.env['__defaultvalue__'] = '(empty)';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.debug]  var1:  (default value)');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_empty.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should not replace when no default', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'defaultValue', 'L0_DefaultValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_nodefault.json');
            process.env['__usedefaultvalue__'] = 'false';
            process.env['__defaultvalue__'] = '';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.issue type=warning;]  variable not found: var1');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_noreplace.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace with default when default', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'defaultValue', 'L0_DefaultValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_default.json');
            process.env['__usedefaultvalue__'] = 'true';
            process.env['__defaultvalue__'] = '[default]';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.debug]  var1: [default] (default value)');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_default.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace with empty when empty default', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'defaultValue', 'L0_DefaultValue.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_emptydefault.json');
            process.env['__usedefaultvalue__'] = 'true';
            process.env['__defaultvalue__'] = '';

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    tr.stdout.should.include('##vso[task.debug]  var1:  (default value)');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_empty.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });
    });

    describe('#recursion', function() {
        it('should not replace recursively when recursion disabled', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'recursion', 'L0_DisabledRecursion.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_disabledrecursion.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected_disabledrecursion.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should replace recursively when recursion', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'recursion', 'L0_Recursion.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_recursion.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let actual: string = fs.readFileSync(process.env['__inputpath__'], 'utf8');
                    let expected: string = fs.readFileSync(path.join(__dirname, 'test_data', 'default.expected.json'), 'utf8');
                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });

        it('should fail when cycle recursion', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'recursion', 'L0_CycleRecursion.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'default_cyclerecursion.json');

            let dataPath: string = path.join(__dirname, 'test_data', 'default.json');
            fs.copyFileSync(
                dataPath, 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(false, 'task succeeded');

                    tr.stdout.should.include('##vso[task.issue type=error;]recursion cycle with token \'var1\'.');
                },
                tr,
                done);
        });
    });

    describe('#misc', function() {
        it('should not replace when binary file', function(done: Mocha.Done) {
            // arrange
            let tp = path.join(__dirname, 'targetFiles', 'L0_InlineReplace.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            process.env['__inputpath__'] = path.join(__dirname, 'test_tmp', 'binary.jpg');
            fs.copyFileSync(
                path.join(__dirname, 'test_data', 'binary.jpg'), 
                process.env['__inputpath__']);

            // act
            tr.run();

            // assert
            runValidation(
                () => {
                    tr.succeeded.should.equal(true, 'task succeeded');

                    let buffer: Buffer = fs.readFileSync(process.env['__inputpath__']);
                    let hash = crypto.createHash('sha256');
                    hash.update(buffer);
                    let actual: string = hash.digest('hex');

                    buffer = fs.readFileSync(path.join(__dirname, 'test_data', 'binary.jpg'));
                    hash = crypto.createHash('sha256');
                    hash.update(buffer);
                    let expected: string = hash.digest('hex');

                    actual.should.equal(expected, 'replaced output');
                },
                tr,
                done);
        });
    });
});