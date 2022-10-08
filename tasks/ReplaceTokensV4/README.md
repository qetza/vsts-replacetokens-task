[![Donate](images/donate.png)](https://www.paypal.me/qetza/5)

# Replace Tokens task
Azure Pipelines extension that replace tokens in **text** files with variable values.

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

**Note:** the task will only work on text files, if you need to replace token in archive file you will need to first extract the files and after archive them back.

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

- **Files encoding** (encoding): the files encoding used for reading and writing. The 'auto' value will determine the encoding based on the Byte Order Mark (BOM) if present; otherwise it will use ascii. (allowed values: auto, ascii, utf-7, utf-8, utf-16le, utf-16be, win1252 and iso88591)
- **Write unicode BOM** (writeBOM): if checked writes an unicode Byte Order Mark (BOM).
- **Escape type** (escapeType): specify how to escape variable values. Value `auto` uses the file extension (`.json` and `.xml`) to determine the escaping and `none` as fallback. (allowed values: auto, none, json, xml and custom)
- **Escape character** (escapeChar): when using `custom` escape type, the escape character to use when escaping characters in the variable values.
- **Characters to escape** (charsToEscape): when using `custom` escape type, characters in variable values to escape before replacing tokens.
- **Verbosity** (verbosity): specify the level of log verbosity. (note: error and system debug are always on) (allowed values: normal, detailed and off)
- **Action on missing variable** (actionOnMissing): specify the action to take on a missing variable.
  - _silently continue_ (continue): the task will continue without displaying any message.
  - _log warning_ (warn): the task will continue but log a warning with the missing variable name.
  - _fail_ (fail): the task will fail and log the missing variable name.
- **Keep token for missing variable** (keepToken): if checked tokens with missing variables will not be replaced by empty string.
- **Action on no file processed** (actionOnNoFiles):  specify the action when no file was processed. (allowed values: continue, warn, fail)
- **Token pattern** (tokenPattern): specify the pattern of the tokens to search in the target files. (allowed values: default, rm, octopus, azpipelines, doublebraces and custom)
- **Token prefix** (tokenPrefix): when using `custom` token pattern, the prefix of the tokens to search in the target files.
- **Token suffix** (tokenSuffix): when using `custom` token pattern, the suffix of the tokens to search in the target files.
- **Use legacy pattern** (useLegacyPattern): if checked whitespaces between the token prefix/suffix and the variable name are not ignored.  
- **Use legacy empty/default feature** (useLegacyEmptyFeature): if check use the old empty & default values features. The new feature/code can now distinguish between an undefined variable and an defined empty variable without the use of a specific "empty" token (_Empty value_ parameter).
- **Empty value** (emptyValue): with legacy empty/default feature: the variable value that will be replaced with an empty string.
- **Use default value** (useDefaultValue): with new empty/default feature: if check replace variable not found with a default value specified in _Default value_.
- **Default value** (defaultValue): the value to be used if a variable is not found. With legacy empty/default feature: do not set to disable default value feature with the legacy feature; to replace with an empty string set the default value to the _Empty value_.
- **Enable transformations** (enableTransforms): if checked transformations can be applied on variable values. The following transformations are available:
  - _lower_: make variable value lower case. Example: `#{lower(MyVar)}#`
  - _upper_: make variable value upper case. Example: `#{upper(MyVar)}#`
  - _noescape_: disable variable value escaping. (this can be used if you want to inject raw JSON or XML for example). Example: `#{noescape(MyVar)}#`
  - _base64_: encode variable value in BASE64. Example `#{base64(MyVar)}#`
- **Transform prefix** (transformPrefix): The prefix between transform name and token name. Default: `(`.
- **Transform suffix** (transformSuffix): The suffix after the token name. Default: `)`.
- **Variable files (JSON or YAML)** (variableFiles): the absolute or relative comma or newline-separated paths to the files containing additional variables. Wildcards can be used (eg: `vars\**\*.json` for all _.json_ files in all sub folders of _vars_). YAML files **must have** the `.yml`or `.yaml` extension otherwise the file is treated as JSON. Variables declared in files overrides variables defined in the pipeline.
- **Inline variables (YAML syntax)** (inlineVariables): A YAML formatted string containing inline variables. Variables declared inline overrides variables defined in the pipeline and in files.
- **Variable separator** (variableSeparator): the separtor to use in variable names for nested objects and arrays in inline variables or variable files. Example: `{ 'My': { 'Value': ['Hello World!'] } }` will create a variable _My.Value.0_ with the value _Hello World!_.
- **Enable recursion in values** (enableRecursion): if checked token replacement (with transformation) will be run on values.Example: "Say: #{value1}#" with value1 = "hello #{upper(value2)}#" and value2 = "world!" will result in "hello WORLD!".
- **Send anonymous usage telemetry** (enableTelemetry): if checked anonymous usage data (hashed collection and pipeline id, no file parameter values, no variable values) will be sent to the task author only to analyze task usage.

### Output variables
The task creates the following as output variables:
- **tokenReplacedCount**: the total number of tokens which were replaced by a variable.
- **tokenFoundCount**: the total number of of tokens which were found.
- **fileProcessedCount**: the total number of files which were processed.
- **transformExecutedCount**: the total number of transformations which were executed.
- **defaultValueCount**: the total number of default value used.

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
**New in 4.2.1**
- Fix compatibility with node 5.10.1 ([#277](https://github.com/qetza/vsts-replacetokens-task/issues/277)).

**New in 4.2.0**
- Add support for inline variables ([#252](https://github.com/qetza/vsts-replacetokens-task/issues/252)).
- Add support for recursive token replacement in values ([#201](https://github.com/qetza/vsts-replacetokens-task/issues/201)).
- Add optional reworked feature to simplify empty and default values (this is a **breaking change** if enabled as the old _Empty value_ is not used anymore but replaced by an empty variable declaration).

**New in 4.1.1**
- Revert migrate tasks to Node10 execution handler ([#233](https://github.com/qetza/vsts-replacetokens-task/issues/233)).

**New in 4.1.0**
- Migrate tasks to Node10 execution handler ([#228](https://github.com/qetza/vsts-replacetokens-task/issues/228), [#230](https://github.com/qetza/vsts-replacetokens-task/issues/230)).

**New in 4.0.0**
- **Breaking change**: Add output variables ([#160](https://github.com/qetza/vsts-replacetokens-task/issues/160)). (some older version of TFS/Azure Pipelines doesn't support output variables when used in release pipelines)
- **Breaking change**: Add dropdown parameter _Token pattern_ to select token pattern ([#131](https://github.com/qetza/vsts-replacetokens-task/issues/131)). (users with customized token pattern will need to manually select one or `custom`)
- Add `base64` transform ([#163](https://github.com/qetza/vsts-replacetokens-task/issues/163)).
- Add action on no file processed ([#210](https://github.com/qetza/vsts-replacetokens-task/issues/210)).