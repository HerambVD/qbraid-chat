const vscode = require('vscode');

let fetch;
(async () => {
  fetch = (await import('node-fetch')).default;
})();


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('qBraid Chat Extension activated!');

    let apiKey = vscode.workspace.getConfiguration('chat-qbraid').get('apiKey') || null; // Get API Key from settings
    let selectedModel = 'default'; // Default model

    console.log(apiKey);

    // Command: Open Chat
    const disposableChat = vscode.commands.registerCommand('chat-qbraid.Open', async () => {
        if (!apiKey) {
            apiKey = await promptForApiKey();
            if (!apiKey) {
                vscode.window.showErrorMessage('API Key is required to use the qBraid chat extension.');
                return;
            }
            // Save API key to settings
            await vscode.workspace.getConfiguration('chat-qbraid').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        }

        const panel = vscode.window.createWebviewPanel(
            'chat-qbraidPanel',
            'qBraid Chat',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        // Fetch available models
        const models = await fetchModels(apiKey);
        if (models.length === 0) {
            vscode.window.showErrorMessage('Failed to fetch models. Check your API Key or network connection.');
            return;
        }
        selectedModel = models[0]; // Default to the first model

        panel.webview.html = getWebviewContent(models, selectedModel);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendPrompt':
                        const responseStream = await fetchChatResponse(apiKey, message.text, selectedModel);
                        if (responseStream) {
                            const reader = responseStream.body.getReader();
                            let partialText = '';
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                partialText += new TextDecoder().decode(value);
                                panel.webview.postMessage({ command: 'streamResponse', text: partialText });
                            }
                        } else {
                            panel.webview.postMessage({ command: 'error', text: 'Failed to fetch response from the API.' });
                        }
                        break;

                    case 'selectModel':
                        selectedModel = message.model;
                        vscode.window.showInformationMessage(`Model selected: ${selectedModel}`);
                        break;

                    case 'setApiKey':
                        apiKey = message.key;
                        vscode.window.showInformationMessage('API Key updated successfully!');
                        await vscode.workspace.getConfiguration('chat-qbraid').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    // Command: Set API Key
    const disposableSettings = vscode.commands.registerCommand('chat-qbraid.setApiKey', async () => {
        apiKey = await promptForApiKey();
        if (apiKey) {
            vscode.window.showInformationMessage('API Key set successfully!');
            await vscode.workspace.getConfiguration('chat-qbraid').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        }
    });

    context.subscriptions.push(disposableChat, disposableSettings);
}


/**
 * Prompt the user to enter their API Key.
 * @returns {Promise<string|null>}
 */
async function promptForApiKey() {
    const key = await vscode.window.showInputBox({
        prompt: 'Enter your qBraid API Key',
        password: true,
        placeHolder: 'API Key...',
        ignoreFocusOut: true,
    });
    return key ? key.trim() : null;
}

/**
 * Fetch available models from GET /chat/models.
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function fetchModels(apiKey) {
    try {
        const response = await fetch('https://api.qbraid.com/chat/models', {
            method: 'GET',
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (response.ok) {
            const data = await response.json();
            return data.models || [];
        }
    } catch (err) {
        console.error('Error fetching models:', err);
    }
    return [];
}

/**
 * Send a chat message via POST /chat and get the response stream.
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string} model
 * @returns {Promise<Response|null>}
 */
async function fetchChatResponse(apiKey, prompt, model) {
    try {
        const response = await fetch('https://api.qbraid.com/chat', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, model }),
        });
        if (response.ok) return response;
    } catch (err) {
        console.error('Error fetching chat response:', err);
    }
    return null;
}

/**
 * Get HTML content for the webview.
 * @param {string[]} models
 * @param {string} selectedModel
 * @returns {string}
 */
function getWebviewContent(models, selectedModel) {
    const modelOptions = models
        .map((model) => `<option value="${model}" ${model === selectedModel ? 'selected' : ''}>${model}</option>`)
        .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            #response { padding: 20px; border-bottom: 1px solid #ddd; min-height: 400px; overflow-y: auto; }
            #form { display: flex; padding: 10px; }
            #input { flex-grow: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
            #send { margin-left: 10px; padding: 10px; background-color: #007acc; color: white; border: none; cursor: pointer; }
            #modelSelect { margin-left: 10px; }
        </style>
    </head>
    <body>
        <div id="response">Welcome to qBraid Chat! Select a model and ask anything.</div>
        <form id="form">
            <select id="modelSelect">${modelOptions}</select>
            <input id="input" placeholder="Type your message here..." />
            <button id="send" type="submit">Send</button>
        </form>
        <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('form').addEventListener('submit', (e) => {
                e.preventDefault();
                const input = document.getElementById('input');
                vscode.postMessage({ command: 'sendPrompt', text: input.value });
                input.value = '';
            });

            document.getElementById('modelSelect').addEventListener('change', (e) => {
                vscode.postMessage({ command: 'selectModel', model: e.target.value });
            });

            window.addEventListener('message', (event) => {
                const message = event.data;
                const response = document.getElementById('response');
                if (message.command === 'streamResponse') {
                    response.innerHTML = message.text;
                } else if (message.command === 'error') {
                    response.innerHTML = '<span style="color: red;">' + message.text + '</span>';
                }
            });
        </script>
    </body>
    </html>`;
}

module.exports = { activate, deactivate: () => {} };