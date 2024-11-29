// types.ts
export interface FileContext {
    userId: string;
    conversationId: string;
    fileName: string;
    content: string;
    cursorPosition: {
        line: number;
        character: number;
    };
}

export interface WebSocketMessage {
    type: 'transcription' | 'code' | 'status' | 'context';
    data?: any;
    text?: string;
    command?: string;
    message?: string;
    code?: string;
}

export interface EditorContext {
    editor: any;
    cursorPosition: {
        line: number;
        character: number;
    };
}

export interface AuthState {
    isLoggedIn: boolean;
    token?: string;
}