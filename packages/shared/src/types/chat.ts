// Chat threads grounded in the therapy material (context pack + FTS5 retrieval).

export interface ChatThread {
    id: number;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
}

export interface ChatMessage {
    id: number;
    thread_id: number;
    role: 'user' | 'assistant';
    // Markdown for assistant messages; plain text for user messages.
    content: string;
    created_at: string;
}
