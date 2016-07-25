##Replace Tokens
This extension contains a build/release task for VS Team Services to replace tokens in files with variable values.

##How to use the build/release task
1. After installing the extension, upload your project to VSTS.
2. Go to your VSTS project, click on the **Release** tab, and create a new release definition.
3. Click **Add tasks** and select **Replace Tokens** from the **Utility** category.
4. Configure the step.

##Links
- [File an issue](https://github.com/qetza/vsts-replacetokens-task/issues)
- [View or contribute to the source code](https://github.com/qetza/vsts-replacetokens-task/)

##Release notes
**New in 1.3.1**
- Fix wrong encoding constructors parameters.

**New in 1.3.0**
- Replaced parameter 'Fail on missing' with 'Action' in 'Missing variables' group.
- Add 'Keep token' parameter in 'Missing variables' group.
- Fix issue on empty file.

**New in 1.2.0**
- Add _Root directory_ task parameter to configure file search root directory (contributed by Jesse Houwing).
- Update _Target files_ task parameter to support newline-separator (contributed by Jesse Houwing).