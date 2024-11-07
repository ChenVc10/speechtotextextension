import * as vscode from 'vscode';
import * as https from 'https';
import * as querystring from 'querystring';

const clientId = 'Ov23liJYWKXe7wm6NH32';
const redirectUri = 'vscode://speech2code.speechtotextextension/callback';

export function startOAuth() {
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user`;
    vscode.env.openExternal(vscode.Uri.parse(url));
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "speechtotextextension" is now active!');

    // Register Hello World command
    const helloWorldCommand = vscode.commands.registerCommand('speechtotextextension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from speechToTextExtension!');
    });
    context.subscriptions.push(helloWorldCommand);

    // Register login page command
    const loginCommand = vscode.commands.registerCommand('speechtotextextension.showLogin', () => {
        showLoginPanel(context);
    });
    context.subscriptions.push(loginCommand);

    // Register GitHub login command
    const githubLoginCommand = vscode.commands.registerCommand('speechtotextextension.githubLogin', () => {
        startOAuth();  // Start GitHub OAuth process
    });
    context.subscriptions.push(githubLoginCommand);
}

// Function to display the login page
function showLoginPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'login', // Identifier
        'Login', // Panel title
        vscode.ViewColumn.One, // Display column
        {
            enableScripts: true // Enable JavaScript
        }
    );

    panel.webview.html = getLoginHtml();
    console.log('Login panel opened'); // Debug information

    // Listen for messages from Webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            console.log('Received message from Webview:', message); // Debug information
            switch (message.command) {
                case 'login':
                    handleLogin(message.email, message.password, panel);
                    break;
                case 'githubLogin':
                    await handleGithubLogin(panel);  // Start GitHub OAuth process
                    break;
                case 'buttonClicked':
                    vscode.window.showInformationMessage('Button clicked in the second page!');
                    break;
                case 'signOut':
                    console.log('Signing out...'); // Debug information
                    panel.webview.html = getLoginHtml(); // Return to login page
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    // Register URI handler to receive GitHub authorization code and update page content
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri(uri: vscode.Uri) {
                const code = uri.query.split('=')[1];
                if (code) {
                    exchangeCodeForToken(code, panel).then((token) => {
                        if (token) {
                            panel.webview.html = getButtonPageHtml(); // Update page content to Button page
                        }
                    }).catch(() => {
                        vscode.window.showErrorMessage('Failed to exchange code for token.');
                    });
                } else {
                    vscode.window.showErrorMessage('No code found in the callback URL');
                }
            }
        })
    );
}

// Handle regular login
function handleLogin(email: string, password: string, panel: vscode.WebviewPanel) {
    if (email && password) {
        panel.webview.html = getButtonPageHtml(); // Update page upon successful login
    } else {
        panel.webview.postMessage({ command: 'loginResult', success: false, message: 'Please enter email and password.' });
    }
}

// Start GitHub OAuth process
function handleGithubLogin(panel: vscode.WebviewPanel) {
    console.log('Handling GitHub login'); // Debug information
    startOAuth();  // Start GitHub OAuth process
}

// Exchange GitHub authorization code for access token
async function exchangeCodeForToken(code: string, panel: vscode.WebviewPanel) {
    const clientId = 'Ov23liJYWKXe7wm6NH32';
    const clientSecret = 'e6e84217da73eb6a065005db82eaa6f1589de618';

    const postData = querystring.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
    });

    const options = {
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                const parsedData = JSON.parse(data);
                if (parsedData.access_token) {
                    vscode.window.showInformationMessage('Successfully logged in to GitHub!');
                    vscode.workspace.getConfiguration().update('githubToken', parsedData.access_token, vscode.ConfigurationTarget.Global);
                    resolve(parsedData.access_token);
                } else {
                    vscode.window.showErrorMessage('Failed to log in to GitHub.');
                    reject(parsedData);
                }
            });
        });

        req.on('error', (error) => {
            vscode.window.showErrorMessage('Network error during GitHub login.');
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Return HTML content for the login page
function getLoginHtml(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    color: #FFFFFF; 
                    background-color: #333; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100vh; 
                    margin: 0;
                }
                .container { 
                    max-width: 320px; 
                    width: 100%;
                    text-align: center; 
                }
                h2 {
                    margin-bottom: 30px;
                    color: #E0E0E0;
                    font-size: 1.8em;
                    font-weight: 400;
                }
                input { 
                    width: 100%; 
                    padding: 10px; 
                    margin: 8px 0; 
                    box-sizing: border-box; 
                    background-color: #444; 
                    border: 1px solid #555;
                    border-radius: 4px;
                    color: #FFF;
                    font-size: 0.9em;
                }
                .button {
                    width: 100%; 
                    padding: 10px; 
                    margin: 10px 0; 
                    background-color: rgba(255, 255, 255, 0.1); 
                    color: #E0E0E0; 
                    border: 1px solid #666; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 0.9em;
                    transition: background-color 0.3s;
                }
                .button:hover {
                    background-color: rgba(255, 255, 255, 0.2);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Speech to Text</h2>
                <input type="email" id="email" placeholder="Email" required>
                <input type="password" id="password" placeholder="Password" required>
                <button class="button" onclick="login()">Login</button>
                <button class="button" onclick="githubLogin()">Login with GitHub</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                
                function login() {
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    vscode.postMessage({ command: 'login', email, password });
                }
                
                function githubLogin() {
                    vscode.postMessage({ command: 'githubLogin' });
                }
            </script>
        </body>
        </html>
    `;
}

// Return HTML content for the button page
function getButtonPageHtml(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Speech to Text</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    color: #FFFFFF; 
                    background-color: #333; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: space-between; 
                    height: 100vh; 
                    margin: 0;
                }
                .header {
                    width: 100%;
                    display: flex; 
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 0;
                }
                .header button {
                    background-color: transparent;
                    color: #E0E0E0;
                    border: none;
                    cursor: pointer;
                    font-size: 0.9em;
                    text-decoration: underline;
                    transition: color 0.3s;
                }
                .header button:hover {
                    color: #FFF;
                }
                .container {
                    width: 100%;
                    max-width: 500px;
                    border: 1px solid #666;
                    border-radius: 6px;
                    padding: 15px;
                    text-align: left;
                    background-color: rgba(255, 255, 255, 0.1);
                    color: #E0E0E0;
                    overflow-y: auto;
                    height: 300px;
                    margin-bottom: 20px;
                    font-size: 0.95em;
                }
                .button {
                    width: 100%;
                    max-width: 300px;
                    padding: 10px; 
                    background-color: rgba(255, 255, 255, 0.1); 
                    color: #E0E0E0; 
                    border: 1px solid #666; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 0.9em;
                    transition: background-color 0.3s;
                    margin-top: 10px;
                }
                .button:hover {
                    background-color: rgba(255, 255, 255, 0.2);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <button onclick="viewHistory()">History</button>
                <button onclick="signOut()">Log Out</button>
            </div>

            <div class="container" id="speechContainer">
                <p>Speech output will appear here...</p>
            </div>

            <button class="button" onclick="onButtonClick()">Start Speech Recognition</button>

            <script>
                const vscode = acquireVsCodeApi();
                
                function onButtonClick() {
                    vscode.postMessage({ command: 'buttonClicked' });
                }

                function signOut() {
                    vscode.postMessage({ command: 'signOut' });
                }

                function viewHistory() {
                    vscode.postMessage({ command: 'viewHistory' });
                }

                // Future implementation for real-time update of speechContainer
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'updateSpeech') {
                        document.getElementById('speechContainer').textContent = message.text;
                    }
                });
            </script>
        </body>
        </html>
    `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
