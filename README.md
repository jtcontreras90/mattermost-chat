# mattermost-chat README

Extension for Mattermost communication.

## Features

* Send message to
  * User
  * Channel

![Send message to user](https://github.com/jtcontreras90/mattermost-chat/blob/master/images/SendMessage.gif?raw=true)
* Send file to
  * User
  * Channel

![Send file to user](https://github.com/jtcontreras90/mattermost-chat/blob/master/images/SendFile.gif?raw=true)
* Send snippet to
  * User
  * Channel

![Send snippet to user](https://github.com/jtcontreras90/mattermost-chat/blob/master/images/SendSnippet.gif?raw=true)

* Refresh saved info: repopulates information about teams, channels and users if needed.


## Extension Settings

* `mattermostChat.token`: Your token to connect to your server. You can set this manually or login on your first interaction with the extension.
* `mattermostChat.server`: The URL to your Mattermost server. You can set this manually or login on your first interaction with the extension.

## Known Issues

This extension doesn't validate inputs (length or file size).

## Release Notes

### 0.0.1

Initial release of Mattermost Chat

### 0.0.2

Added "Refresh saved info" functionality
