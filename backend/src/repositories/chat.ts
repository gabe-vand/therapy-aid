// Queries on chat_threads and chat_messages. One narrow function per query: params in, rows out.
// Messages cascade-delete with their thread (FK), so deleteChatThread is a single statement.
import { asc, count, desc, eq } from 'drizzle-orm';
import { chat_messages } from '@/db/schema/chat-messages';
import { chat_threads } from '@/db/schema/chat-threads';
import { db } from '@/services/common/svc-db';

export type ChatThreadRow = typeof chat_threads.$inferSelect;
export type ChatMessageRow = typeof chat_messages.$inferSelect;
export type ChatThreadListRow = ChatThreadRow & { message_count: number };

const thread_columns = { id: chat_threads.id, title: chat_threads.title, created_at: chat_threads.created_at, updated_at: chat_threads.updated_at, message_count: count(chat_messages.id) };

/** Opens a new thread (the title column defaults to 'New chat' when `title` is omitted). */
export const insertChatThread = (title?: string): ChatThreadRow => {
    const now = new Date().toISOString();
    return db
        .insert(chat_threads)
        .values({ ...(title ? { title } : { title: 'New chat' }), created_at: now, updated_at: now })
        .returning()
        .get();
};

/** Every thread with its message count, most recently active first. */
export const selectChatThreads = (): ChatThreadListRow[] =>
    db.select(thread_columns).from(chat_threads).leftJoin(chat_messages, eq(chat_messages.thread_id, chat_threads.id)).groupBy(chat_threads.id).orderBy(desc(chat_threads.updated_at), desc(chat_threads.id)).all();

/** One thread with its message count, or null. */
export const selectChatThreadById = (id: number): ChatThreadListRow | null =>
    db.select(thread_columns).from(chat_threads).leftJoin(chat_messages, eq(chat_messages.thread_id, chat_threads.id)).where(eq(chat_threads.id, id)).groupBy(chat_threads.id).get() ?? null;

/** Deletes a thread; its messages go with it by FK cascade. */
export const deleteChatThread = (id: number): void => {
    db.delete(chat_threads).where(eq(chat_threads.id, id)).run();
};

/** Every message of a thread, oldest first. */
export const selectChatMessages = (thread_id: number): ChatMessageRow[] => db.select().from(chat_messages).where(eq(chat_messages.thread_id, thread_id)).orderBy(asc(chat_messages.id)).all();

/** The newest `limit` messages of a thread, returned oldest first. */
export const selectRecentChatMessages = (thread_id: number, limit: number): ChatMessageRow[] => db.select().from(chat_messages).where(eq(chat_messages.thread_id, thread_id)).orderBy(desc(chat_messages.id)).limit(limit).all().reverse();

/** Stores one finished exchange atomically: the user's message, the assistant's answer, and the
    thread bump (updated_at, plus a new title when `title` is given). Nothing is stored if any
    part fails. */
export const insertChatExchange = (values: { thread_id: number; user_content: string; assistant_content: string; title: string | null }): { user: ChatMessageRow; assistant: ChatMessageRow } =>
    db.transaction((tx) => {
        const now = new Date().toISOString();
        const add = (role: 'user' | 'assistant', content: string) => tx.insert(chat_messages).values({ thread_id: values.thread_id, role, content, created_at: now }).returning().get();
        const user = add('user', values.user_content);
        const assistant = add('assistant', values.assistant_content);
        tx.update(chat_threads)
            .set({ updated_at: now, ...(values.title ? { title: values.title } : {}) })
            .where(eq(chat_threads.id, values.thread_id))
            .run();
        return { user, assistant };
    });
