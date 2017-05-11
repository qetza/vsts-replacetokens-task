[![Donate](images/donate.png)](https://www.paypal.me/grouchon/5)

# Replace Tokens task
Visual Studio Team Services Build and Release extension that replace tokens in files with variable values.

## Usage
Add a new task, select **Replace Tokens** from the **Utility** category and configure it as needed.

![Replace Tokens parameters](images/task-parameters.png)

Parameters include:
- **Root directory**: the base directory for searching files. If not specified the default working directory will be used.
- **Target files**: the absolute or relative newline-separated paths to the files to replace tokens. Wildcards can be used (eg: `**\*.config` for all config files in all sub folders).
- **Files encoding**: the files encoding used for reading and writing. The 'auto' value will determine the encoding based on the Byte Order Mark (BOM) if present; otherwise it will use ascii.
- **Write unicode BOM**: if checked writes an unicode Byte Order Mark (BOM).
- **Action**: specify the action to take on a missing variable.
  - _silently continue_: the task will continue without displaying any message.
  - _log warning_: the task will continue but log a warning with the missing variable name.
  - _fail_: the task will fail and log the missing variable name.
- **Keep token**: if checked tokens with missing variables will not be replaced by empty string.
- **Token prefix**: the prefix of the tokens to search in the target files.
- **Token suffix**: the suffix of the tokens to search in the target files.

## Tips
If you want to use tokens in XML based configuration files to be replaced during deployment and also have those files usable for local development you can combine the [Replace Tokens task](https://marketplace.visualstudio.com/items?itemName=qetza.replacetokens) with the [XDT tranform task](https://marketplace.visualstudio.com/items?itemName=qetza.xdttransform):
- create an XDT transformation file containing your tokens
- setup your configuration file with local developement values
- at deployment time
  - inject your tokens in the configuration file by using your transformation file
  - replace tokens in your updated configuration file

## Release notes
**New in 2.1.0**
- Add support for comma-separator in _Target files_ ([#35](https://github.com/qetza/vsts-replacetokens-task/issues/35)).

**New in 2.0.2**
- Fix invalid file permissions after saving files.

**New in 2.0.0**
- **Breaking change**: Migrated code to typescript to support cross-platform agent. This change requires the use of an agent at least in version 2.105.0 which is **not compatible with TFS 2015**. If you need to install the task on TFS 2015, download the vsix from the repository: [https://github.com/qetza/vsts-replacetokens-task/releases/download/v1.4.1/qetza.replacetokens-1.4.1.vsix](https://github.com/qetza/vsts-replacetokens-task/releases/download/v1.4.1/qetza.replacetokens-1.4.1.vsix)
- **Breaking change**: _File encoding_ parameter is now used when reading and writing files. Previously it was only used when writing.
- **Breaking change**: _File encoding_ doesn't support 'utf-32' and 'utf-32 (big endian)' anymore.
- **Breaking change**: _Target files_ parameter now only uses the new line as a separator for multi-values (previously it used new-line and semi-colon).
- Removed required _Root directory_, an empty value is equivalent to $(System.DefaultWorkingDirectory).

**New in 1.4.1**
- Fix missing method issue with new xplat agent (2.104.1)

**New in 1.4.0**
- Add variables expansion in variable values.
- Escape token prefix and suffix in regex pattern.

**New in 1.3.1**
- Fix wrong encoding constructors parameters.

**New in 1.3.0**
- Replaced parameter _Fail on missing_ with _Action_ in _Missing variables_ group.
- Add _Keep token_ parameter in 'Missing variables' group.
- Fix issue on empty file.

**New in 1.2.0**
- Add _Root directory_ task parameter to configure file search root directory (contributed by Jesse Houwing).
- Update _Target files_ task parameter to support newline-separator (contributed by Jesse Houwing).