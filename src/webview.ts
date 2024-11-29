// webview.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class WebviewPanel {
    private panel: vscode.WebviewPanel | undefined;
    private isLoggedIn: boolean = false;

    constructor(private context: vscode.ExtensionContext) {}

    public show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'speechToCode',
            'Speech To Text',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
                ],
                portMapping: [{
                    webviewPort: 9001,
                    extensionHostPort: 9001
                }]
            }
        );

        // Initially show login page
        this.panel.webview.html = this.getLoginHtml();
        this.setupMessageHandling();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private setupMessageHandling() {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'githubLogin':
                        vscode.commands.executeCommand('speechtotextextension.githubLogin');
                        break;
                    case 'startRecording':
                        vscode.commands.executeCommand('speechtotextextension.startRecording');
                        break;
                    case 'stopRecording':
                        vscode.commands.executeCommand('speechtotextextension.stopRecording');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    public showLoginPage() {
        if (this.panel) {
            this.panel.webview.html = this.getLoginHtml();
        }
    }

    public updateToSpeechUI() {
        if (this.panel) {
            this.isLoggedIn = true;
            this.panel.webview.html = this.getSpeechHtml();
        }
    }

    public updateStatus(message: string) {
        if (this.panel) {
            this.panel.webview.postMessage({ 
                type: 'status', 
                message: message 
            });
        }
    }

    public updateText(text: string) {
        if (this.panel) {
            this.panel.webview.postMessage({ 
                type: 'transcription', 
                text: text 
            });
        }
    }

    private getLoginHtml(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ws: wss:; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
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

    private getSpeechHtml(): string {
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
            <button class="button" id="stopButton" disabled>Stop Recognition</button>
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
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                            audio: {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true,
                                channelCount: 1
                            } 
                        });
                        
                        updateStatus("Microphone access granted.");
                        micStream = stream;
                        audioContext = new AudioContext();
                        const source = audioContext.createMediaStreamSource(stream);
                        const processor = audioContext.createScriptProcessor(256, 1, 1);

                        processor.onaudioprocess = (event) => {
                            if (socket && socket.readyState === WebSocket.OPEN) {
                                const inputData = event.inputBuffer.getChannelData(0);
                                const outputData = new Int16Array(inputData.length);

                                for (let i = 0; i < inputData.length; i++) {
                                    outputData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                                }

                                const metadata = JSON.stringify({
                                    sampleRate: audioContext.sampleRate
                                });
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
                        socket = new WebSocket("ws://localhost:9001");

                        socket.onopen = () => {
                            updateStatus("Connected to WebSocket server.");
                            displaySpeech("Listening for speech...");
                            startButton.disabled = true;
                            stopButton.disabled = false;
                            vscode.postMessage({ command: 'startRecording' });
                        };

                        socket.onmessage = (event) => {
                            try {
                                const data = JSON.parse(event.data);
                                if (data.type === 'transcription') {
                                    displaySpeech(data.text);
                                }
                            } catch (e) {
                                console.error('Error parsing message:', e);
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
                    vscode.postMessage({ command: 'stopRecording' });
                }

                stopButton.addEventListener('click', () => {
                    stopRecording();
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'status':
                            updateStatus(message.message);
                            break;
                        case 'transcription':
                            displaySpeech(message.text);
                            break;
                    }
                });

                // Initialize button states
                stopButton.disabled = true;
            </script>
        </body>
        </html>`;
    }

    public dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }
}