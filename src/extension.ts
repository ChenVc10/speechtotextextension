// extension.ts
import * as vscode from 'vscode';
import * as https from 'https';
import * as querystring from 'querystring';
import { WebSocketManager } from './websocket';
import { WebviewPanel } from './webview';
import { FileContext, WebSocketMessage } from './types';

// GitHub OAuth credentials
const clientId = 'Ov23liJYWKXe7wm6NH32';
const clientSecret = 'e6e84217da73eb6a065005db82eaa6f1589de618';
const redirectUri = 'vscode://speech2code.speechtotextextension/callback';

// Global variables
let webviewPanel: WebviewPanel | undefined;
let wsManager: WebSocketManager | undefined;
let currentEditor: vscode.TextEditor | undefined;
let lastCursorPosition: vscode.Position | null = null;
let micInstance: any = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "speechtotextextension" is now active!');

    // Initialize WebSocket manager
    wsManager = new WebSocketManager(handleWebSocketMessage);
    wsManager.connectToDockerService();

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    statusBarItem.text = "$(unmute) Speech To Text";
    statusBarItem.tooltip = "Click to start speech recognition";
    statusBarItem.command = 'speechtotextextension.showSpeechUI';
    statusBarItem.show();
    
    context.subscriptions.push(statusBarItem);

    // Track cursor position
    vscode.window.onDidChangeTextEditorSelection((event) => {
        currentEditor = event.textEditor;
        lastCursorPosition = event.selections[0].active;
        
        if (currentEditor && wsManager) {
            const context: FileContext = {
                userId: 'user-id', // Replace with actual user ID from GitHub
                conversationId: Date.now().toString(),
                fileName: currentEditor.document.fileName,
                content: currentEditor.document.getText(),
                cursorPosition: {
                    line: lastCursorPosition.line,
                    character: lastCursorPosition.character
                }
            };
            wsManager.sendFileContext(context);
        }
    });

    // Register commands
    const commands = [
        vscode.commands.registerCommand('speechtotextextension.showSpeechUI', () => {
            webviewPanel = new WebviewPanel(context);
            webviewPanel.show();
        }),
        vscode.commands.registerCommand('speechtotextextension.githubLogin', () => {
            startOAuth();
        }),
        vscode.commands.registerCommand('speechtotextextension.startRecording', handleStartRecording),
        vscode.commands.registerCommand('speechtotextextension.stopRecording', handleStopRecording),
        vscode.commands.registerCommand('speechtotextextension.confirmText', handleConfirmText),
        vscode.commands.registerCommand('speechtotextextension.cancelText', handleCancelText)
    ];

    context.subscriptions.push(...commands);

    // Register URI handler for OAuth callback
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri(uri: vscode.Uri) {
                const code = uri.query.split('=')[1];
                if (code) {
                    exchangeCodeForToken(code).then((token) => {
                        if (token && webviewPanel) {
                            vscode.window.showInformationMessage('Successfully logged in to GitHub!');
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

function handleWebSocketMessage(message: WebSocketMessage) {
    switch (message.type) {
        case 'transcription':
            if (webviewPanel && message.text) {
                webviewPanel.updateText(message.text);
            }
            break;
        case 'code':
            if (currentEditor && lastCursorPosition && message.code) {
                insertCodeAtPosition(message.code);
            }
            break;
    }
}

function insertCodeAtPosition(code: string) {
    if (!currentEditor || !lastCursorPosition) return;

    currentEditor.edit(editBuilder => {
        editBuilder.insert(lastCursorPosition!, code);
    }).then(success => {
        if (success) {
            vscode.window.showInformationMessage('Code inserted successfully');
        } else {
            vscode.window.showErrorMessage('Failed to insert code');
        }
    });
}

function startOAuth() {
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user`;
    vscode.env.openExternal(vscode.Uri.parse(url));
}

async function exchangeCodeForToken(code: string): Promise<string> {
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
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.access_token) {
                        vscode.workspace.getConfiguration().update(
                            'githubToken', 
                            parsedData.access_token, 
                            vscode.ConfigurationTarget.Global
                        );
                        resolve(parsedData.access_token);
                    } else {
                        reject(new Error('No access token received'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function handleStartRecording() {
    if (micInstance) {
        vscode.window.showInformationMessage('Recording is already in progress.');
        return;
    }

    if (!webviewPanel) {
        vscode.window.showErrorMessage('Speech panel not found.');
        return;
    }

    try {
        webviewPanel.updateStatus('Starting recording...');
        vscode.window.showInformationMessage('Starting recording...');
        
        if (wsManager) {
            wsManager.handleRecordingStart();
        }
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

    if (!webviewPanel) {
        vscode.window.showErrorMessage('Speech panel not found.');
        return;
    }

    try {
        if (micInstance) {
            micInstance.stop();
            micInstance = null;
        }
        
        webviewPanel.updateStatus('Recording stopped.');
        vscode.window.showInformationMessage('Recording stopped.');

        if (wsManager) {
            wsManager.handleRecordingStop();
        }
    } catch (error) {
        console.error('Error stopping recording:', error);
        vscode.window.showErrorMessage('Failed to stop recording.');
    }
}

function handleConfirmText(text: string) {
    if (currentEditor && lastCursorPosition && text) {
        insertCodeAtPosition(text);
    }
}

function handleCancelText() {
    if (webviewPanel) {
        webviewPanel.updateText('Waiting for speech...');
    }
}

export function deactivate() {
    if (wsManager) {
        wsManager.close();
    }
    if (webviewPanel) {
        webviewPanel.dispose();
    }
    if (micInstance) {
        try {
            micInstance.stop();
            micInstance = null;
        } catch (error) {
            console.error('Error stopping recording during deactivation:', error);
        }
    }
}