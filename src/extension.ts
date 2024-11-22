import * as vscode from 'vscode';
import * as https from 'https';
import * as querystring from 'querystring';

const clientId = 'Ov23liJYWKXe7wm6NH32';
const clientSecret = 'e6e84217da73eb6a065005db82eaa6f1589de618';
const redirectUri = 'vscode://speech2code.speechtotextextension/callback';

// Keep track of the login panel
let loginPanel: vscode.WebviewPanel | undefined;

export function startOAuth() {
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user`;
    vscode.env.openExternal(vscode.Uri.parse(url));
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "speechtotextextension" is now active!');

    // Register commands
    const commands = [
        vscode.commands.registerCommand('speechtotextextension.helloWorld', () => {
            vscode.window.showInformationMessage('Hello World from speechToTextExtension!');
        }),
        vscode.commands.registerCommand('speechtotextextension.showLogin', () => {
            showLoginPanel(context);
        }),
        vscode.commands.registerCommand('speechtotextextension.githubLogin', () => {
            startOAuth();
        })
    ];

    context.subscriptions.push(...commands);

    // Register URI handler for OAuth callback
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri(uri: vscode.Uri) {
                const code = uri.query.split('=')[1];
                if (code) {
                    if (loginPanel) {
                        exchangeCodeForToken(code, loginPanel).then((token) => {
                            if (token) {
                                loginPanel!.webview.html = getButtonPageHtml();
                            }
                        }).catch(() => {
                            vscode.window.showErrorMessage('Failed to exchange code for token.');
                        });
                    }
                } else {
                    vscode.window.showErrorMessage('No code found in the callback URL');
                }
            }
        })
    );
}

function showLoginPanel(context: vscode.ExtensionContext) {
    if (loginPanel) {
        loginPanel.reveal();
        return;
    }

    loginPanel = vscode.window.createWebviewPanel(
        'login',
        'Login',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            enableFindWidget: true,
            retainContextWhenHidden: true,
            localResourceRoots: [],
            portMapping: [{
                webviewPort: 9001,
                extensionHostPort: 9001
            }]
        }
    );

    loginPanel.webview.html = getLoginHtml();
    console.log('Login panel opened');

    // Handle panel disposal
    loginPanel.onDidDispose(() => {
        loginPanel = undefined;
    }, null, context.subscriptions);

    // Handle messages from webview
    loginPanel.webview.onDidReceiveMessage(
        async (message) => {
            console.log('Received message from Webview:', message);
            switch (message.command) {
                case 'githubLogin':
                    await handleGithubLogin();
                    break;
                case 'signOut':
                    console.log('Signing out...');
                    loginPanel!.webview.html = getLoginHtml();
                    break;
                case 'startRecording':
                    handleStartRecording();
                    break;
                case 'stopRecording':
                    handleStopRecording();
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

async function handleGithubLogin() {
    console.log('Handling GitHub login');
    startOAuth();
}

async function exchangeCodeForToken(code: string, panel: vscode.WebviewPanel): Promise<string> {
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
                try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.access_token) {
                        vscode.window.showInformationMessage('Successfully logged in to GitHub!');
                        vscode.workspace.getConfiguration().update('githubToken', parsedData.access_token, vscode.ConfigurationTarget.Global);
                        resolve(parsedData.access_token);
                    } else {
                        vscode.window.showErrorMessage('Failed to log in to GitHub.');
                        reject(new Error('No access token received'));
                    }
                } catch (error) {
                    reject(error);
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

function getLoginHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ws: wss:; media-src mediastream: https: http: data: blob: *; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';">
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
    </html>`;
}

function getButtonPageHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ws: wss:; media-src mediastream: https: http: data: blob: *; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';">
        <title>Speech to Text</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #333;
                color: #E0E0E0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .container {
                width: 100%;
                max-width: 600px;
                border: 1px solid #666;
                border-radius: 8px;
                padding: 20px;
                background-color: rgba(255, 255, 255, 0.1);
                overflow-y: auto;
                height: 300px;
                margin-bottom: 20px;
            }
            .button {
                width: 200px;
                padding: 10px;
                margin: 10px;
                background-color: rgba(255, 255, 255, 0.1);
                color: #E0E0E0;
                border: 1px solid #666;
                border-radius: 4px;
                cursor: pointer;
                font-size: 1em;
                transition: background-color 0.3s;
            }
            .button:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }
            .button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .status {
                margin-top: 10px;
                font-style: italic;
                color: #888;
            }
            .error {
                color: #ff6b6b;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <h1>Speech to Text</h1>
        <div class="container" id="speechContainer">
            <p>Waiting for speech...</p>
        </div>
        <button class="button" id="startButton">Start Recognition</button>
        <button class="button" id="stopButton">Stop Recognition</button>
        <p class="status" id="statusMessage"></p>
        
        <script>
            const vscode = acquireVsCodeApi();
            let socket;
            let audioContext;
            let micStream;
            const speechContainer = document.getElementById('speechContainer');
            const statusMessage = document.getElementById('statusMessage');
            const startButton = document.getElementById('startButton');
            const stopButton = document.getElementById('stopButton');

            function updateStatus(message) {
                statusMessage.textContent = message;
                console.log(message);
            }

            function displaySpeech(text) {
                const paragraph = document.createElement('p');
                paragraph.textContent = text;
                speechContainer.appendChild(paragraph);
                speechContainer.scrollTop = speechContainer.scrollHeight;
            }

            function displayError(message) {
                const errorElement = document.createElement('p');
                errorElement.className = 'error';
                errorElement.textContent = message;
                speechContainer.appendChild(errorElement);
            }

            startButton.addEventListener('click', async () => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    updateStatus("WebSocket is already open.");
                    return;
                }

                try {
                    updateStatus("Requesting microphone access...");
                    
                    // Request microphone access with specific constraints
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        } 
                    });
                    
                    updateStatus("Microphone access granted.");
                    
                    micStream = stream;
                    audioContext = new AudioContext();
                    const source = audioContext.createMediaStreamSource(micStream);
                    const processor = audioContext.createScriptProcessor(256, 1, 1);

                    processor.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
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

                    source.connect(processor);
                    processor.connect(audioContext.destination);

                    updateStatus("Connecting to WebSocket server...");
                    socket = new WebSocket("ws://127.0.0.1:9001");

                    socket.onopen = () => {
                        updateStatus("Connected to WebSocket server.");
                        displaySpeech("Listening for speech...");
                        startButton.disabled = true;
                        stopButton.disabled = false;
                    };

                    socket.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        if (data.type === 'realtime') {
                            displaySpeech(data.text);
                        }
                    };

                    socket.onerror = (error) => {
                        updateStatus("WebSocket error occurred.");
                        displayError("Connection error: " + error.message);
                        stopRecording();
                    };

                    socket.onclose = () => {
                        updateStatus("Disconnected from WebSocket server.");
                        displaySpeech("Stopped listening.");
                        startButton.disabled = false;
                        stopButton.disabled = true;
                    };

                } catch (error) {
                    console.error('Error:', error);
                    updateStatus("Error accessing microphone");
                    displayError(\`Failed to access microphone. Please make sure:
                        1. Your microphone is properly connected
                        2. You've granted microphone permissions to VSCode
                        3. No other application is using the microphone
                        
                        Error details: \${error.message}\`);
                    
                    startButton.disabled = false;
                    stopButton.disabled = true;
                }
            });

            function stopRecording() {
                if (socket) {
                    socket.close();
                }
                if (audioContext) {
                    audioContext.close();
                }
                if (micStream) {
                    micStream.getTracks().forEach(track => track.stop());
                }
                
                startButton.disabled = false;
                stopButton.disabled = true;
                updateStatus("Recognition stopped.");
            }

            stopButton.addEventListener('click', () => {
                stopRecording();
            });

            // Initialize button states
            stopButton.disabled = true;
        </script>
    </body>
    </html>`;
}

let micInstance: any = null;

function handleStartRecording() {
    if (micInstance) {
        vscode.window.showInformationMessage('Recording is already in progress.');
        return;
    }

    if (!loginPanel) {
        vscode.window.showErrorMessage('Login panel not found.');
        return;
    }

    try {
        loginPanel.webview.postMessage({ type: 'status', message: 'Starting recording...' });
        vscode.window.showInformationMessage('Starting recording...');
    } catch (error) {
        console.error('Error starting recording:', error);
        vscode.window.showErrorMessage('Failed to start recording.');
    }
}

function handleStopRecording() {
    if (!micInstance) {
        vscode.window.showInformationMessage('No recording in progress.');
        return;
    }

    if (!loginPanel) {
        vscode.window.showErrorMessage('Login panel not found.');
        return;
    }

    try {
        if (micInstance) {
            micInstance.stop();
            micInstance = null;
        }
        loginPanel.webview.postMessage({ type: 'status', message: 'Recording stopped.' });
        vscode.window.showInformationMessage('Recording stopped.');
    } catch (error) {
        console.error('Error stopping recording:', error);
        vscode.window.showErrorMessage('Failed to stop recording.');
    }
}

export function deactivate() {
    if (loginPanel) {
        loginPanel.dispose();
    }
}