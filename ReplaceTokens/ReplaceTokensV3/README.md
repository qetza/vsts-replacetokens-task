[![Donate](images/donate.png)](https://www.paypal.me/grouchon/5)

# Replace Tokens task
Azure Pipelines extension that replace tokens in files with variable values.

## Usage
If you are using the UI, add a new task, select **Replace Tokens** from the **Utility** category and configure it as needed.

If your are using a YAML file, add a task with the following syntax:
```yaml
- task: qetza.replacetokens.replacetokens-task.replacetokens@3
  displayName: 'Replace tokens'
  inputs:
    targetFiles: |
      **/*.config
      **/*.json => outputs/*.json
```

## Parameters
The parameters of the task are described bellow, in parenthesis is the YAML name:

- **Root directory** (rootDirectory): the base directory for searching files. If not specified the default working directory will be used.
- **Target files** (targetFiles): the absolute or relative newline-separated paths to the files to replace tokens. Wildcards can be used (eg: `**\*.config` for all _.config_ files in all sub folders).
> **Syntax**: {file path}[ => {output path}]  
>
> - `web.config` will replace tokens in _web.config_ and update the file.
> - `web.tokenized.config => web.config` will replace tokens in _web.tokenized.config_ and save the result in _web.config_.
> - `config\web.tokenized.config => c:\config\web.config` will replace tokens in _config\web.tokenized.config_ and save the result in _c:\\config\web.config_.
>
> **Wildcard support**
> - `*.tokenized.config => *.config` will replace tokens in all _{filename}.tokenized.config_ target files and save the result in _{filename}.config_.
> - `**\*.tokenized.config => c:\tmp\*.config` will replace tokens in all _{filename}.tokenized.config_ target files and save the result in _c:\tmp\\{filename}.config_.
>
> Only the wildcard _*_ in the target file name will be used for replacement in the output.\
> Relative paths in the output pattern are relative to the target file path.\
>
> **Negative pattern**\
> If you want to use negative pattern in target file, use a semi-colon `;` to separate the including pattern and the negative patterns. When using output syntax, only the wildcard in the first pattern will be used for generating the output path.
> - `**\*.tokenized.config;!**\dev\*.config => c:\tmp\*.config` will replace tokens in all _{filename}.tokenized.config_ target files except those under a _dev_ directory and save the result in _c:\tmp\\{filename}.config_.

- **Files encoding** (encoding): the files encoding used for reading and writing. The 'auto' value will determine the encoding based on the Byte Order Mark (BOM) if present; otherwise it will use ascii.
- **Write unicode BOM** (writeBOM): if checked writes an unicode Byte Order Mark (BOM).
- **Escape type** (escapeType): specify how to escape variable values. Value `auto` uses the file extension (`.json` and `.xml`) to determine the escaping and `none` as fallback.
- **Escape character** (escapeChar): when using `custom` escape type, the escape character to use when escaping characters in the variable values.
- **Characters to escape** (charsToEscape): when using `custom` escape type, characters in variable values to escape before replacing tokens.
- **Verbosity** (verbosity): specify the level of log verbosity. (note: error and system debug are always on)
- **Action on missing variable** (actionOnMissing): specify the action to take on a missing variable.
  - _silently continue_: the task will continue without displaying any message.
  - _log warning_: the task will continue but log a warning with the missing variable name.
  - _fail_: the task will fail and log the missing variable name.
- **Keep token for missing variable** (keepToken): if checked tokens with missing variables will not be replaced by empty string.
- **Action on no file processed** (actionOnNoFiles):  specify the action when no file was processed.
- **Token prefix** (tokenPrefix): the prefix of the tokens to search in the target files.
- **Token suffix** (tokenSuffix): the suffix of the tokens to search in the target files.
- **Use legacy pattern** (useLegacyPattern): if checked whitespaces between the token prefix/suffix and the variable name are not ignored.  
- **Empty value** (emptyValue): the variable value that will be replaced with an empty string.
- **Default value** (defaultValue): the value to be used if a variable is not found. Do not set to disable default value feature. (to replace with an empty string set the default value to the _Empty value_)
- **Enable transformations** (enableTransforms): if checked transformations can be applied on variable values. The following transformations are available:
  - _lower_: make variable value lower case. Example: `#{lower(MyVar)}#`
  - _upper_: make variable value upper case. Example: `#{upper(MyVar)}#`
  - _noescape_: disable variable value escaping. (this can be used if you want to inject raw JSON or XML for example). Example: `#{noescape(MyVar)}#`
- **Transform prefix** (transformPrefix): The prefix between transform name and token name. Default: `(`.
- **Transform suffix** (transformSuffix): The suffix after the token name. Default: `)`.
- **Variable files (JSON or YAML)** (variableFiles): the absolute or relative comma or newline-separated paths to the files containing additional variables. Wildcards can be used (eg: `vars\**\*.json` for all _.json_ files in all sub folders of _vars_). YAML files **must have** the `.yml`or `.yaml` extension otherwise the file is treated as JSON. Variables declared in files overrides variables defined in the pipeline.
- **Variable separator** (variableSeparator): the separtor to use in variable names for nested objects and arrays in variable files. Example: `{ 'My': { 'Value': ['Hello World!'] } }` will create a variable _My.Value.0_ with the value _Hello World!_.
- **Send anonymous usage telemetry** (enableTelemetry): if checked anonymous usage data (hashed collection and pipeline id, no file parameter values, no variable values) will be sent to the task author only to analyze task usage.

## Data/Telemetry
The Replace Tokens task for Azure Pipelines collects anonymous usage data and sends them to its author to help improve the product by default. If you don’t wish to send usage data, you can change your telemetry settings through _Send anonymous usage telemetry_ parameter or by setting a variable or environment variable `REPLACETOKENS_DISABLE_TELEMETRY` to `true`.

## Tips
If you want to use tokens in XML based configuration files to be replaced during deployment and also have those files usable for local development you can combine the [Replace Tokens task](https://marketplace.visualstudio.com/items?itemName=qetza.replacetokens) with the [XDT tranform task](https://marketplace.visualstudio.com/items?itemName=qetza.xdttransform):
- create an XDT transformation file containing your tokens
- setup your configuration file with local developement values
- at deployment time
  - inject your tokens in the configuration file by using your transformation file
  - replace tokens in your updated configuration file

## Release notes
**New in 3.9.0**
- Migrate tasks to Node10 execution handler ([#228](https://github.com/qetza/vsts-replacetokens-task/issues/228), [#230](https://github.com/qetza/vsts-replacetokens-task/issues/230)).

**New in 3.8.0**
- Add `base64` transform ([#163](https://github.com/qetza/vsts-replacetokens-task/issues/163)).
- Add action on no file processed ([#210](https://github.com/qetza/vsts-replacetokens-task/issues/210)).

**New in 3.7.1**
- Fix issue on binary files ([#193](https://github.com/qetza/vsts-replacetokens-task/issues/193)).
- Rollback output variables ([#196](https://github.com/qetza/vsts-replacetokens-task/issues/196)).

**New in 3.7.0**
- Add output variables _tokenReplacedCount_, _tokenFoundCount_ and _fileProcessedCount_ ([#160](https://github.com/qetza/vsts-replacetokens-task/issues/160)).
- Add support for variable transformations with _Enable tranformations_ ([#96](https://github.com/qetza/vsts-replacetokens-task/issues/96)).
- Add default value for tokens not found with _Default value_ (contribution from [ClemensSutor](https://github.com/ClemensSutor)).
- Group log outputs in Azure Pipelines output.
- Add support for variables in external YAML files with `.yml` or `.yaml` extension ([#177](https://github.com/qetza/vsts-replacetokens-task/issues/177)).

**New in 3.6.0**
- Add parameter _Use legacy pattern_ with default value to `false`. 

**New in 3.5.2**
- Fix issue when token prefix present but not as a token prefix ([#149](https://github.com/qetza/vsts-replacetokens-task/issues/149)).

**New in 3.5.1**
- Fix issue when variable `System.ServerType` is not defined ([#147](https://github.com/qetza/vsts-replacetokens-task/issues/147)).

**New in 3.5.0**
- Add anonymous usage telemetry.
- Ignore spaces between token prefix/suffix and variable name ([#143](https://github.com/qetza/vsts-replacetokens-task/issues/143)).

**New in 3.4.1**
- Fix JSON escaping of slash `/` ([#138](https://github.com/qetza/vsts-replacetokens-task/issues/138))

**New in 3.4.0**
- Add summary in logs with number of tokens found and replaced ([#126](https://github.com/qetza/vsts-replacetokens-task/issues/126)).
- Add support for variables in external JSON files ([#113](https://github.com/qetza/vsts-replacetokens-task/issues/113)).

**New in 3.3.1**
- **Breaking change**: If you were using negative pattern you need to use the semi colon `;` as a separator instead of new-line in _Target files_.
- Fix negative pattern support ([#127](https://github.com/qetza/vsts-replacetokens-task/issues/127)).

**New in 3.3.0**
- Add support for custom output file and wildcard support ([#114](https://github.com/qetza/vsts-replacetokens-task/issues/114)).

**New in 3.2.2**
- Fix matching issue with directory ([#122](https://github.com/qetza/vsts-replacetokens-task/issues/122)).

**New in 3.2.1**
- Fix log issue with escaped secret values.

**New in 3.2.0**
- Switch to [jschardet](https://github.com/aadsm/jschardet) for encoding detection when selecting `auto` in _File encoding_ ([#99](https://github.com/qetza/vsts-replacetokens-task/issues/99)).
- Switch to [azure-pipelines-task-lib](https://github.com/Microsoft/azure-pipelines-task-lib) v2.8.0.
- Add `auto` to _Escape type_ and set it as default value.
- Move _Escape type_, _Escape character_ and _Characters to escape_ to the main paramters section for easier discoverability.

**New in 3.1.0**
- Add _Verbosity_ parameter to allow detail logs without using `system.debug`.

**New in 3.0.0**
- **Breaking change**: If you were using the character escaping feature you need to select `custom` in _Escape values type_ parameter.
- Add support to escape JSON in variable values (contributed by Justin Gould)
- Add support to escape XML in variable values (contributed by Justin Gould)
- Add `Windows 1252` and `ISO 8859-1` encoding to _File encoding_ ([#67](https://github.com/qetza/vsts-replacetokens-task/issues/67))