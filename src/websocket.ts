// websocket.ts
import WebSocket = require('ws');
import { WebSocketMessage, FileContext } from './types';
import * as vscode from 'vscode';

export class WebSocketManager {
    private ws: WebSocket | null = null;
    private wss: WebSocket.Server | null = null;
    private port = 9001;
    private clients: Set<WebSocket> = new Set();

    constructor(private messageHandler: (message: WebSocketMessage) => void) {
        this.initServer();
    }

    private initServer() {
        try {
            this.wss = new WebSocket.Server({ port: this.port });
            console.log(`WebSocket server started on port ${this.port}`);

            this.wss.on('connection', (ws: WebSocket) => {
                console.log('Client connected');
                this.clients.add(ws);

                ws.on('message', (data: WebSocket.Data) => {
                    try {
                        // Handle binary data for audio
                        if (data instanceof Buffer) {
                            this.handleAudioData(data);
                            return;
                        }

                        // Handle JSON messages
                        const message = JSON.parse(data.toString());
                        this.messageHandler(message);
                    } catch (err) {
                        console.error('Error processing message:', err);
                    }
                });

                ws.on('close', () => {
                    console.log('Client disconnected');
                    this.clients.delete(ws);
                });

                ws.on('error', (error) => {
                    console.error('WebSocket error:', error);
                });
            });
        } catch (error) {
            console.error('Failed to initialize WebSocket server:', error);
            vscode.window.showErrorMessage('Failed to start WebSocket server');
        }
    }

    private handleAudioData(data: Buffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const metadata = {
                sampleRate: 16000,
                channels: 1,
                format: 'raw'
            };

            const metadataStr = JSON.stringify(metadata);
            const metadataBytes = Buffer.from(metadataStr);
            const metadataLength = Buffer.alloc(4);
            metadataLength.writeInt32LE(metadataBytes.length, 0);

            const combinedData = Buffer.concat([
                metadataLength,
                metadataBytes,
                data
            ]);

            this.ws.send(combinedData);
        }
    }

    public handleRecordingStart() {
        this.broadcast({
            type: 'status',
            message: 'Recording started'
        });
    }

    public handleRecordingStop() {
        this.broadcast({
            type: 'status',
            message: 'Recording stopped'
        });
    }

    public sendToClient(message: WebSocketMessage) {
        this.broadcast(message);
    }

    public broadcast(message: WebSocketMessage) {
        const messageString = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageString);
            }
        });
    }

    public sendFileContext(context: FileContext) {
        this.broadcast({
            type: 'context',
            data: context
        });
    }

    public connectToDockerService() {
        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket('ws://localhost:9001');
        
        this.ws.on('open', () => {
            console.log('Connected to Docker speech service');
        });

        this.ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.type === 'transcription') {
                    this.broadcast(response);
                }
            } catch (error) {
                console.error('Error processing response:', error);
            }
        });

        this.ws.on('error', (error) => {
            console.error('Docker service connection error:', error);
        });

        this.ws.on('close', () => {
            console.log('Docker service connection closed');
            setTimeout(() => this.connectToDockerService(), 5000);
        });
    }

    public close() {
        this.clients.forEach(client => client.close());
        if (this.ws) {
            this.ws.close();
        }
        if (this.wss) {
            this.wss.close();
        }
    }
}