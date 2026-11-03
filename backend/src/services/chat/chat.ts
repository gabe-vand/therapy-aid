// Chat: threads CRUD and sendMessage, the one turn of conversation. A turn = last 30 messages as
// history + a user message (today's date, the question, the FTS5 leads) + a cached system prefix
// (persona, context pack), run through the tool loop on the 'chat' task. The exchange is stored
// only after the model answered, so a failed turn leaves no half-saved question and a retry
// with the same text never duplicates it.
import type { ChatMessage, ChatThread } from '@therapy-aid/shared';
import * as repo_chat from '@/repositories/chat';
import { AiOutputError, completeWithTools, systemBlocks, type ConversationMessage } from '@/services/common/svc-claude';
import { buildContextPack } from '@/services/context/context-pack';
import { formatDay } from '@/services/context/format';
import { searchDocuments } from '@/services/search/search';
import { CHAT_PERSONA, buildUserTurn } from './prompts';
import { CHAT_TOOLS, runChatTool } from './tools';

export const HISTORY_LIMIT = 30;
const TITLE_CHARS = 60;
const EXCERPT_LIMIT = 5;

/** A thread's title from its first message: whitespace collapsed, first 60 characters. */
export const titleFromMessage = (content: string): string => content.replace(/\s+/g, ' ').trim().slice(0, TITLE_CHARS).trimEnd() || 'New chat';

/** Stored messages → API history. The window can cut mid-exchange; the API needs the first
    message to be the user's, so a leading assistant message is dropped. */
export const toHistory = (rows: repo_chat.ChatMessageRow[]): ConversationMessage[] => {
    const first_user = rows.findIndex((row) => row.role === 'user');
    return first_user < 0 ? [] : rows.slice(first_user).map((row) => ({ role: row.role, content: row.content }));
};

/** Every thread with its message count, most recently active first. */
export const listThreads = (): ChatThread[] => repo_chat.selectChatThreads();

/** Opens an empty thread. */
export const createThread = (): ChatThread => ({ ...repo_chat.insertChatThread(), message_count: 0 });

/** A thread and all its messages (oldest first); null when it doesn't exist. */
export const getThread = (id: number): { thread: ChatThread; messages: ChatMessage[] } | null => {
    const thread = repo_chat.selectChatThreadById(id);
    return thread ? { thread, messages: repo_chat.selectChatMessages(id) } : null;
};

/** Deletes a thread and its messages. False when it didn't exist. */
export const deleteThread = (id: number): boolean => {
    if (!repo_chat.selectChatThreadById(id)) return false;
    repo_chat.deleteChatThread(id);
    return true;
};

/** Answers one message. Null when the thread doesn't exist; throws an AiError (safe to show) when
    the model can't answer, in which case nothing is stored. The first message names the thread. */
export const sendMessage = async (thread_id: number, content: string): Promise<{ user: ChatMessage; assistant: ChatMessage } | null> => {
    const thread = repo_chat.selectChatThreadById(thread_id);
    if (!thread) return null;

    const history = toHistory(repo_chat.selectRecentChatMessages(thread_id, HISTORY_LIMIT));
    const hits = searchDocuments(content, { limit: EXCERPT_LIMIT });
    const reply = await completeWithTools({
        task: 'chat',
        system: systemBlocks([CHAT_PERSONA, buildContextPack()]),
        messages: [...history, { role: 'user', content: buildUserTurn(content, hits, formatDay(new Date().toISOString())) }],
        tools: CHAT_TOOLS,
        run_tool: runChatTool,
    });
    if (!reply) throw new AiOutputError('The AI reply was empty. Try again.');

    return repo_chat.insertChatExchange({ thread_id, user_content: content.trim(), assistant_content: reply, title: thread.message_count === 0 ? titleFromMessage(content) : null });
};
