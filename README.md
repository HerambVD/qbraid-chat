# qBraid Chat Extension

qBraid Chat is a Visual Studio Code extension that integrates qBraid's REST API endpoints for AI-driven model-based chat functionality.

## Features

- Open a chat prompt directly within VS Code
- Set and use your qBraid API key for authenticated requests
- Easy-to-use interface for interacting with qBraid services

## Commands

1. **Open Chat Prompt**:
   - Command: `qbraid-chat.Open`
   - Opens the chat prompt for interacting with qBraid models.

2. **Set API Key**:
   - Command: `qbraid-chat.setApiKey`
   - Allows you to set your API key for qBraid authentication.

## Configuration

You can configure your API key in the extension settings:
- Go to **File > Preferences > Settings** (or press `Ctrl+,`).
- Search for `qBraid Chat`.
- Enter your API key under `qbraid-chat.apiKey`.

## Requirements

- Visual Studio Code version `1.96.0` or later.
- A valid qBraid API key.

## Installation

1. Download the `.vsix` file from the release page or package it locally.
2. Install it in VS Code:
   - Open Extensions view (`Ctrl+Shift+X`).
   - Click the ellipsis menu (`...`) and select **Install from VSIX...**.
3. Enjoy!

## Feedback

If you encounter issues or have feature requests, please submit them on the [GitHub repository](#).

---

### **2. Try Packaging Again**
Once you’ve updated the `README.md`, re-run the packaging command:

```bash
npx @vscode/vsce package