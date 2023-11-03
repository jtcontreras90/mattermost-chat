import axios from "axios";
import * as vscode from 'vscode';
import { removeIndentation } from './indentation';

const BASE_PATH = 'api/v4';
const CREATE_DIRECT_CHANNEL = `${BASE_PATH}/channels/direct`;
const CREATE_POST = `${BASE_PATH}/posts`;
const CREATE_FILE = `${BASE_PATH}/files`;
const CURRENT_USER_PATH = `${BASE_PATH}/users/me`;
const LIST_USERS_PATH = `${BASE_PATH}/users`;
const LIST_TEAMS_PATH = `${BASE_PATH}/teams`;
const LOGIN_PATH = `${BASE_PATH}/users/login`;

interface User {
  username: string;
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
}

interface Team {
  id: string;
  display_name: string;
}

interface Channel {
  name: string;
  id: string;
  display_name: string;
  type: string;
  team_id: string;
}

export class Mattermost {
  private token: string;
  private server: string;
  private users: Array<{ label: string, id: string, description: string }>;
  private channels: Array<{ label: string, id: string, description: string }>;
  private teams: Map<string, string>;
  private currentUserId: string | undefined;
  private ready: boolean;
  constructor(token: string, server: string) {
    this.token = token;
    this.server = server;
    this.users = [];
    this.channels = [];
    this.teams = new Map<string, string>();
    this.ready = false;
  }

  private async checkServer(force = false) {
    if (!force && this.server) { return; }

    await vscode.window.showInputBox({
      placeHolder: 'https://customers.mattermost.com',
      prompt: vscode.l10n.t('Enter your Mattermost server.'),
      value: this.server,
      ignoreFocusOut: true
    }).then(
      serverUrl => {
        const configuration = vscode.workspace.getConfiguration();
        const target = vscode.ConfigurationTarget.Global;
        this.server = serverUrl as string;
        configuration.update('mattermostChat.server', serverUrl, target);
      }
    );
  }

  private async checkCredentials(force = false) {
    if (!force && this.token) { return; }

    const selectedOption = await vscode.window.showQuickPick(
      [{
        label: vscode.l10n.t('Use User and Password'),
        description: 'Credentials',
        value: 1
      },
      {
        label: vscode.l10n.t('Use Personal Access Token'),
        description: 'Token',
        value: 2
      }
      ], { placeHolder: vscode.l10n.t('Select authentication method'), ignoreFocusOut: true }
    )
    if (selectedOption?.value == 1) {
      await this.credentialsAuthentication();
    } else if (selectedOption?.value == 2) {
      await this.tokenAuthentication();
    }
  }

  private async tokenAuthentication() {
    await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter your personal access token'),
      ignoreFocusOut: true
    }).then(
      token => {
        this.setToken(token as string);
      }
    );
  }

  private async credentialsAuthentication() {
    const user = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter your user'),
      ignoreFocusOut: true
    });
    const password = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter your password'),
      ignoreFocusOut: true
    });
    const mfaToken = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter your MFA token (optional)'),
      ignoreFocusOut: true
    });
    await axios.post(
      `${this.server}/${LOGIN_PATH}`,
      { login_id: user, password: password, token: mfaToken }
    ).then((response) => this.setToken(response.headers.token))
  }

  private setToken(token: string) {
    const configuration = vscode.workspace.getConfiguration();
    const target = vscode.ConfigurationTarget.Global;
    this.token = token as string;
    configuration.update('mattermostChat.token', token, target);
  }

  private async populateUsers(force = false, page = 0) {
    if (!force && this.users.length > 0) { return; }

    await axios.get(`${this.server}/${LIST_USERS_PATH}`,
      {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        params: { page: page, per_page: 200, active: true },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' }
      }).then(
        ({ data }) => {
          if (data.length > 0) {
            data.forEach((user: User) => {
              this.users.push({
                label: user['username'],
                id: user['id'],
                description: [
                  `${user['first_name']} ${user['last_name']}`.trim(), user['nickname'].trim()
                ].filter(n => n).join(' | ')
              });
            });
            this.populateUsers(force, page + 1);
          }
        }
      );
  }

  private async populateTeams(force = false, page = 0) {
    if (!force && this.teams.size > 0) { return; }

    await axios.get(`${this.server}/${LIST_TEAMS_PATH}`,
      {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        params: { page: page, per_page: 200 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' }
      }).then(
        ({ data }) => {
          if (data.length > 0) {
            data.forEach((team: Team) => {
              this.teams.set(team['id'], team['display_name']);
            });
            this.populateTeams(force, page + 1);
          }
        }
      );
  }

  private async populateChannels(force = false) {
    if (!force && this.channels.length > 0) { return; }

    await axios.get(`${this.server}/${LIST_USERS_PATH}/${this.currentUserId}/channels`,
      {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' }
      }).then(
        ({ data }) => {
          data.forEach((channel: Channel) => {
            if (channel['name'] && channel['display_name'] && channel['type'] !== 'G') {
              this.channels.push({
                label: channel['display_name'],
                description: this.teams.get(channel['team_id']) as string,
                id: channel['id']
              });
            }
          });
        }
      );
  }

  private async populateInfo(force = false) {
    await this.checkServer(force);
    await this.checkCredentials(force);
    await this.setCurrentUser();
    await this.populateUpdatableInfo(force);
    this.ready = true;
  }

  private async populateUpdatableInfo(force = false) {
    await this.populateTeams(force);
    await this.populateChannels(force);
    await this.populateUsers(force);
  }

  private async prepareMessage() {
    if (this.ready) { return; }

    try {
      await this.populateInfo()
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status == 401) {
        while (!this.ready) {
          this.populateInfo(true);
        }
      }
    }
  }

  private async setCurrentUser() {
    try {
      const { data } = await axios.get(`${this.server}/${CURRENT_USER_PATH}`,
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' }
        })
      this.currentUserId = data['id'];
    }
    catch (error) {
      if (axios.isAxiosError(error) && error.response?.status == 401) {
        vscode.window.showInformationMessage(
          vscode.l10n.t('Your token has expired or the credentials are incorrect. Please try again.')
        )
        throw error;
      }
    }
  }

  async sendNewMessageToUser() {
    await this.prepareMessage()
    vscode.window.showQuickPick<{ label: string, description: string, id: string }>(
      this.users, { placeHolder: vscode.l10n.t('Select the user') }
    ).then(
      user => {
        if (!user) { return; }

        axios.post(
          `${this.server}/${CREATE_DIRECT_CHANNEL}`,
          [this.currentUserId, user.id],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          { headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' } }
        ).then(({ data }) => {
          vscode.window.showInputBox({ placeHolder: vscode.l10n.t('Write your message') }).then(
            message => {
              this.sendMessage(data['id'], message);
            });
        });
      }
    );
  }

  async sendFileToUser() {
    await this.prepareMessage()
    vscode.window.showQuickPick<{ label: string, description: string, id: string }>(
      this.users, { placeHolder: vscode.l10n.t('Select the user') }
    ).then(
      user => {
        if (!user) { return; }

        axios.post(
          `${this.server}/${CREATE_DIRECT_CHANNEL}`,
          [this.currentUserId, user.id],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          { headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' } }
        ).then(({ data }) => {
          const currentEditor = vscode.window.activeTextEditor;
          this.sendFile(data['id'], currentEditor?.document);
        });
      }
    );
  }

  async sendCodeSnippetToUser() {
    await this.prepareMessage()
    vscode.window.showQuickPick(this.users, { placeHolder: vscode.l10n.t('Select the user') }).then(
      user => {
        if (!user) { return; }

        axios.post(
          `${this.server}/${CREATE_DIRECT_CHANNEL}`,
          [this.currentUserId, user.id],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          { headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' } }
        ).then(({ data }) => {
          const currentEditor = vscode.window.activeTextEditor;
          currentEditor?.document
          if (!currentEditor) { return; }

          const selection = currentEditor.selection;
          const message = `
\`\`\`${currentEditor.document.languageId}
${removeIndentation(currentEditor.document.getText(selection)).trim()}
\`\`\`
          `.trim();
          this.sendMessage(data['id'], message);
        });
      }
    );
  }

  async sendNewMessageToChannel() {
    await this.prepareMessage()
    vscode.window.showQuickPick(this.channels, { placeHolder: vscode.l10n.t('Select the channel') }).then(
      channel => {
        if (!channel) { return; }

        vscode.window.showInputBox({ placeHolder: vscode.l10n.t('Write your message') }).then(
          message => {
            this.sendMessage(channel.id as string, message);
          });
      }
    );
  }

  async sendFileToChannel() {
    await this.prepareMessage()
    vscode.window.showQuickPick(this.channels, { placeHolder: vscode.l10n.t('Select the channel') }).then(
      channel => {
        if (!channel) { return; }


        const currentEditor = vscode.window.activeTextEditor;
        this.sendFile(channel.id, currentEditor?.document);
      }
    );
  }

  async sendCodeSnippetToChannel() {
    await this.prepareMessage()
    vscode.window.showQuickPick(this.channels, { placeHolder: vscode.l10n.t('Select the channel') }).then(
      channel => {
        if (!channel) { return; }

        const currentEditor = vscode.window.activeTextEditor;
        if (!currentEditor) { return; }

        const selection = currentEditor.selection;
        const message = `
\`\`\`${currentEditor.document.languageId}
${removeIndentation(currentEditor.document.getText(selection)).trim()}
\`\`\`
        `.trim();
        this.sendMessage(channel.id as string, message);
      }
    );
  }

  private async sendMessage(channelId: string, message: string | undefined, file?: string) {
    if (!message && !file) { return; }

    axios.post(
      `${this.server}/${CREATE_POST}`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      { channel_id: channelId, message: message, file_ids: [file] },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      { headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'application/json' } }
    );
  }

  private async sendFile(channelId: string, file: vscode.TextDocument | undefined) {
    if (!file) { return; }

    const fileName = await vscode.window.showInputBox(
      { placeHolder: vscode.l10n.t('Enter your file name'), value: file.fileName.split('/').at(-1) }
    )
    const formData = new FormData();
    const blob = new Blob([file.getText()], { type: 'plain/text' })
    formData.append('files', blob, fileName)
    formData.append('channel_id', channelId);
    try {
      await axios.post(
        `${this.server}/${CREATE_FILE}`,
        formData,
        { headers: { 'Authorization': `Bearer ${this.token}`, 'content-type': 'multipart/form-data' } }
      ).then((response => {
        this.sendMessage(channelId, '', response.data['file_infos'][0].id)
      }));
    } catch (error) {
      if (error instanceof Error) {
        console.log(error?.message);
      }
      if (typeof (error) === 'string') {
        console.log(error);
      }
    }
  }
}
