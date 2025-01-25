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

    let apiKey = vscode.workspace.getConfiguration('qbraid-chat').get('apiKey') || null; // Get API Key from settings
    let selectedModel = 'default'; // Default model
    let chatHistory = []; // Store chat history

    // Command: Open Chat
    const disposableChat = vscode.commands.registerCommand('qbraid-chat.Open', async () => {
        if (!apiKey) {
            apiKey = await promptForApiKey();
            if (!apiKey) {
                vscode.window.showErrorMessage('API Key is required to use the qBraid chat extension.');
                return;
            }
            // Save API key to settings
            await vscode.workspace.getConfiguration('qbraid-chat').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        }

        const panel = vscode.window.createWebviewPanel(
            'qbraid-chatPanel',
            'qBraid Chat',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        // Fetch available models
        const res = await fetchModels(apiKey);
        const models = res.map((model) => model.model);
        if (models.length === 0) {
            vscode.window.showErrorMessage('Failed to fetch models. Check your API Key or network connection.');
            return;
        }
        selectedModel = models[0]; // Default to the first model

        panel.webview.html = getWebviewContent(models, selectedModel, chatHistory);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendPrompt':
                        const userPrompt = message.text.trim();
                        if (!userPrompt) {
                            panel.webview.postMessage({ command: 'error', text: 'Prompt cannot be empty.' });
                            return;
                        }

                        // Add user message to chat history
                        chatHistory.push({ role: 'user', text: userPrompt });
                        panel.webview.postMessage({ command: 'updateHistory', history: chatHistory });

                        try {
                            const responseStream = await fetchChatResponse(apiKey, userPrompt, selectedModel);
                            if (responseStream && responseStream.content) {
                                const finalText = responseStream.content; // Assuming 'content' has the final text response

                                // Add API response to chat history
                                chatHistory.push({ role: 'assistant', text: finalText });
                                panel.webview.postMessage({ command: 'updateHistory', history: chatHistory });
                            } else {
                                panel.webview.postMessage({ command: 'error', text: 'Failed to fetch response: No content received.' });
                            }
                        } catch (err) {
                            console.error('Error processing chat response:', err);
                            panel.webview.postMessage({ command: 'error', text: 'An error occurred while fetching the response.' });
                        }
                        break;

                    case 'selectModel':
                        selectedModel = message.model;
                        vscode.window.showInformationMessage(`Model selected: ${selectedModel}`);
                        break;

                    case 'clearHistory':
                        chatHistory = []; // Clear chat history
                        panel.webview.postMessage({ command: 'updateHistory', history: chatHistory });
                        break;

                    case 'setApiKey':
                        apiKey = message.key;
                        vscode.window.showInformationMessage('API Key updated successfully!');
                        await vscode.workspace.getConfiguration('qbraid-chat').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    // Command: Set API Key
    const disposableSettings = vscode.commands.registerCommand('qbraid-chat.setApiKey', async () => {
        apiKey = await promptForApiKey();
        if (apiKey) {
            vscode.window.showInformationMessage('API Key set successfully!');
            await vscode.workspace.getConfiguration('qbraid-chat').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
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
        const options = { method: 'GET', headers: { 'api-key': apiKey } };
        const response = await fetch('https://api.qbraid.com/api/chat/models', options);
        if (response.ok) {
            const data = await response.json();
            return data;
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
        const options = {
            method: 'POST',
            headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, stream: false }),
        };
        const response = await fetch('https://api.qbraid.com/api/chat', options);
        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (err) {
        console.error('Error fetching chat response:', err);
    }
    return null;
}

/**
 * Fetch available models from GET /chat/models.
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function fetchDevices(apiKey) {
    try {
        const options = { method: 'GET', headers: { 'api-key': apiKey } };
        const response = await fetch('https://api.qbraid.com/api/quantum-devices', options);
        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (err) {
        console.error('Error fetching models:', err);
    }
    return [];
}

/**
 * Fetch available models from GET /chat/models.
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function fetchJobs(apiKey) {
    try {
        const options = { method: 'GET', headers: { 'api-key': apiKey } };
        const response = await fetch('https://api.qbraid.com/api/quantum-jobs', options);
        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (err) {
        console.error('Error fetching models:', err);
    }
    return [];
}


/**
 * Get HTML content for the webview.
 * @param {string[]} models
 * @param {string} selectedModel
 * @param {Array} chatHistory
 * @returns {string}
 */
function getWebviewContent(models, selectedModel, chatHistory) {
    const modelOptions = models
        .map((model) => `<option value="${model}" ${model === selectedModel ? 'selected' : ''}>${model}</option>`)
        .join('');

    const historyHtml = chatHistory
        .map(
            (entry) =>
                `<div><strong>${entry.role === 'user' ? 'You' : 'Assistant'}:</strong> ${entry.text}</div>`
        )
        .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #f4f4f6; 
                color: #333; 
            }
            #response { 
                padding: 20px; 
                border-bottom: 1px solid #ddd; 
                min-height: 400px; 
                max-height: 500px; 
                overflow-y: auto; 
                background-color: #ffffff; 
                border-radius: 8px; 
                box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1); 
                margin: 20px; 
            }
            #response div { 
                margin-bottom: 10px; 
                padding: 10px; 
                border-radius: 8px; 
            }
            #response div:nth-child(odd) { 
                background-color: #e9f5ff; 
            }
            #response div:nth-child(even) { 
                background-color: #fdfdfd; 
            }
            #response div strong { 
                font-weight: bold; 
                color: #007acc; 
            }
            #form { 
                display: flex; 
                padding: 10px 20px; 
                background-color: #ffffff; 
                border-top: 1px solid #ddd; 
                box-shadow: 0px -2px 8px rgba(0, 0, 0, 0.1); 
            }
            #input { 
                flex-grow: 1; 
                padding: 10px; 
                border: 1px solid #ccc; 
                border-radius: 20px; 
                outline: none; 
                font-size: 14px; 
                margin-right: 10px; 
                box-shadow: inset 0px 2px 4px rgba(0, 0, 0, 0.1); 
                transition: border-color 0.2s ease-in-out; 
            }
            #input:focus { 
                border-color: #007acc; 
            }
            #send, #clear { 
                padding: 10px 20px; 
                border: none; 
                border-radius: 20px; 
                cursor: pointer; 
                font-size: 14px; 
                transition: background-color 0.3s ease-in-out; 
            }
            #send { 
                background-color: #007acc; 
                color: white; 
                margin-right: 10px; 
            }
            #send:hover { 
                background-color: #005b99; 
            }
            #clear { 
                background-color: #e0e0e0; 
                color: #333; 
            }
            #clear:hover { 
                background-color: #c6c6c6; 
            }
            #modelSelect { 
                margin-right: 10px; 
                padding: 10px; 
                border-radius: 20px; 
                border: 1px solid #ccc; 
                background-color: #ffffff; 
                outline: none; 
                font-size: 14px; 
                box-shadow: inset 0px 2px 4px rgba(0, 0, 0, 0.1); 
            }
            #modelSelect:focus { 
                border-color: #007acc; 
            }
        </style>
    </head>
    <body>
        <div id="response">${historyHtml || 'Welcome to qBraid Chat! Select a model and ask anything.'}</div>
        <form id="form">
            <select id="modelSelect">${modelOptions}</select>
            <input id="input" placeholder="Type your message here..." />
            <button id="send" type="submit">Send</button>
            <button id="clear" type="button">Clear</button>
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

            document.getElementById('clear').addEventListener('click', () => {
                vscode.postMessage({ command: 'clearHistory' });
            });

            window.addEventListener('message', (event) => {
                const message = event.data;
                const response = document.getElementById('response');
                if (message.command === 'updateHistory') {
                    response.innerHTML = message.history
                        .map(entry => \`<div><strong>\${entry.role === 'user' ? 'You' : 'Assistant'}:</strong> \${entry.text}</div>\`)
                        .join('');
                } else if (message.command === 'error') {
                    response.innerHTML += '<div style="color: red;">' + message.text + '</div>';
                }
            });
        </script>
    </body>
    </html>`;
}

module.exports = { activate, deactivate: () => {} };