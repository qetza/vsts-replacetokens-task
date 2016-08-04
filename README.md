[![Donate](https://raw.githubusercontent.com/qetza/vsts-replacetokens-task/master/images/donate.png)](https://www.paypal.me/grouchon/5)

# Replace tokens task for Visual Studio Team Services
This extension contains a build/release task for VS Team Services to replace tokens in files with variable values.

# How to use the build/release task
1. After installing the extension, upload your project to VSTS.
2. Go to your VSTS project, click on the **Release** tab, and create a new release definition.
3. Click **Add tasks** and select **Replace Tokens** from the **Utility** category.
4. Configure the step.

# Release notes
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