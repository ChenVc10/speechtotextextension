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
        startOAuth();
    });
    context.subscriptions.push(githubLoginCommand);
}

// Function to display the login page with only GitHub login
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
    console.log('Login panel opened');

    // Listen for messages from Webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            console.log('Received message from Webview:', message);
            if (message.command === 'githubLogin') {
                await handleGithubLogin(panel);  // Start GitHub OAuth process
            } else if (message.command === 'signOut') {
                console.log('Signing out...');
                panel.webview.html = getLoginHtml(); // Return to login page
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

// Start GitHub OAuth process
function handleGithubLogin(panel: vscode.WebviewPanel) {
    console.log('Handling GitHub login');
    startOAuth();  // Start GitHub OAuth process
}

// Exchange GitHub authorization code for access token
async function exchangeCodeForToken(code: string, panel: vscode.WebviewPanel) {
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

const Mic = require('mic');

let micInstance: any = null;

function startRecording(panel: vscode.WebviewPanel) {
    if (micInstance) {
        vscode.window.showInformationMessage('Recording is already in progress.');
        return;
    }

    micInstance = Mic({
        rate: '16000', // 采样率
        channels: '1', // 单声道
        debug: false
    });

    const micInputStream = micInstance.getAudioStream();

    // 监听麦克风数据
    micInputStream.on('data', (data: Buffer) => {
        panel.webview.postMessage({
            type: 'audio',
            audioData: data.toString('base64') // 将音频数据编码为 Base64
        });
    });

    micInstance.start();
    panel.webview.postMessage({ type: 'status', message: 'Recording started.' });
    vscode.window.showInformationMessage('Recording started.');
}

function stopRecording(panel: vscode.WebviewPanel) {
    if (micInstance) {
        micInstance.stop();
        micInstance = null;
        panel.webview.postMessage({ type: 'status', message: 'Recording stopped.' });
        vscode.window.showInformationMessage('Recording stopped.');
    } else {
        vscode.window.showInformationMessage('No recording in progress.');
    }
}



function getSpeechToTextHtml(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Speech to Text</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    background-color: #333;
                    color: #FFF;
                }
                #output {
                    margin: 20px 0;
                    padding: 10px;
                    border: 1px solid #FFF;
                    height: 200px;
                    overflow-y: auto;
                }
                button {
                    padding: 10px 20px;
                    font-size: 16px;
                    color: #FFF;
                    background-color: #007ACC;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #005A9E;
                }
            </style>
        </head>
        <body>
            <h1>Speech to Text</h1>
            <button id="recordButton">Start Recording</button>
            <div id="output">Waiting for audio...</div>
            <script>
                const vscode = acquireVsCodeApi();
                let isRecording = false;
                const button = document.getElementById('recordButton');
                const output = document.getElementById('output');

                button.addEventListener('click', () => {
                    if (isRecording) {
                        vscode.postMessage({ command: 'stopRecording' });
                        button.textContent = 'Start Recording';
                    } else {
                        vscode.postMessage({ command: 'startRecording' });
                        button.textContent = 'Stop Recording';
                    }
                    isRecording = !isRecording;
                });

                // 接收主进程发送的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'status') {
                        output.innerHTML += '<p>' + message.message + '</p>';
                    } else if (message.type === 'audio') {
                        output.innerHTML += '<p>Audio received: ' + atob(message.audioData).length + ' bytes</p>';
                    }
                });
            </script>
        </body>
        </html>
    `;
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
                <h2>Login with GitHub</h2>
                <button class="button" onclick="githubLogin()">Login with GitHub</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                
                function githubLogin() {
                    vscode.postMessage({ command: 'githubLogin' });
                }
            </script>
        </body>
        </html>
    `;
}


function getButtonPageHtml() {
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

            <button class="button" onclick="startSpeechRecognition()">Start Speech Recognition</button>

            <script>
                const vscode = acquireVsCodeApi();
                let socket;
                let fullSentences = [];
                let mic_available = false;

                function displayRealtimeText(message) {
                    const container = document.getElementById('speechContainer');
                    container.innerHTML += "<p>" + message + "</p>";
                    container.scrollTop = container.scrollHeight;
                }

                function startSpeechRecognition() {
                    navigator.mediaDevices.getUserMedia({ audio: true })
                        .then(stream => {
                            mic_available = true;
                            displayRealtimeText("Microphone access granted. Start speaking...");

                            const audioContext = new AudioContext();
                            const source = audioContext.createMediaStreamSource(stream);
                            const processor = audioContext.createScriptProcessor(256, 1, 1);

                            source.connect(processor);
                            processor.connect(audioContext.destination);

                            processor.onaudioprocess = function(e) {
                                const inputData = e.inputBuffer.getChannelData(0);
                                const outputData = new Int16Array(inputData.length);

                                for (let i = 0; i < inputData.length; i++) {
                                    outputData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                                }

                                if (socket && socket.readyState === WebSocket.OPEN) {
                                    const metadata = JSON.stringify({ sampleRate: audioContext.sampleRate });
                                    const metadataBytes = new TextEncoder().encode(metadata);
                                    const metadataLength = new ArrayBuffer(4);
                                    const metadataLengthView = new DataView(metadataLength);
                                    metadataLengthView.setInt32(0, metadataBytes.byteLength, true);

                                    const combinedData = new Blob([metadataLength, metadataBytes, outputData.buffer]);
                                    socket.send(combinedData);
                                }
                            };
                        })
                        .catch(error => {
                            displayRealtimeText("Microphone access denied. Error: " + error.message);
                        });
                }

                function viewHistory() {
                    vscode.postMessage({ command: 'viewHistory' });
                }

                function signOut() {
                    vscode.postMessage({ command: 'signOut' });
                }

                window.onload = function() {
                    socket = new WebSocket("ws://127.0.0.1:9001");
                    socket.onopen = () => displayRealtimeText("Connected to server.");
                    socket.onclose = () => displayRealtimeText("Disconnected from server.");
                    socket.onerror = () => displayRealtimeText("Error connecting to server.");
                };
            </script>
        </body>
        </html>
    `;
}







// This method is called when your extension is deactivated
export function deactivate() {}
