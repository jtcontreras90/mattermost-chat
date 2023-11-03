// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Mattermost } from './mattermost';

let mattermost: Mattermost;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  mattermost = new Mattermost(
    vscode.workspace.getConfiguration().get('mattermostChat.token') as string,
    vscode.workspace.getConfiguration().get('mattermostChat.server') as string
  );

  const sendMessageToUserDisposable = vscode.commands.registerCommand('mattermost-chat.sendNewMessageToUser', () => {
    mattermost.sendNewMessageToUser();
  });
  context.subscriptions.push(sendMessageToUserDisposable);
  const sendFileToUserDisposable = vscode.commands.registerCommand('mattermost-chat.sendFileToUser', () => {
    mattermost.sendFileToUser();
  });
  context.subscriptions.push(sendFileToUserDisposable);
  const sendSnippetToUserDisposable = vscode.commands.registerCommand('mattermost-chat.sendCodeSnippetToUser', () => {
    mattermost.sendCodeSnippetToUser();
  });
  context.subscriptions.push(sendSnippetToUserDisposable);
  const sendMessageToChannelDisposable = vscode.commands.registerCommand('mattermost-chat.sendNewMessageToChannel', () => {
    mattermost.sendNewMessageToChannel();
  });
  context.subscriptions.push(sendMessageToChannelDisposable);
  const sendFileToChannelDisposable = vscode.commands.registerCommand('mattermost-chat.sendFileToChannel', () => {
    mattermost.sendFileToChannel();
  });
  context.subscriptions.push(sendFileToChannelDisposable);
  const sendSnippetToChannelDisposable = vscode.commands.registerCommand('mattermost-chat.sendCodeSnippetToChannel', () => {
    mattermost.sendCodeSnippetToChannel();
  });
  context.subscriptions.push(sendSnippetToChannelDisposable);
}

// This method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() { }
