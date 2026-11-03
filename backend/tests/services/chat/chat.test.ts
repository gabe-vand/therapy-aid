import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_chat from '@/repositories/chat';
import { CHAT_PERSONA } from '@/services/chat/prompts';
import { HISTORY_LIMIT, createThread, deleteThread, getThread, listThreads, sendMessage, titleFromMessage, toHistory } from '@/services/chat/chat';
import * as svc_claude from '@/services/common/svc-claude';
import { reindexDocument } from '@/services/search/search';
import { resetDatabase, seedJournal, seedSession } from '../../helpers/hlp-db';

// sendMessage: history window, retrieval leads, cached prefix, auto-title, nothing stored on failure.

beforeEach(() => resetDatabase());

type ToolCall = Parameters<typeof svc_claude.completeWithTools>[0];

let tools_spy: ReturnType<typeof spyOn>;
beforeEach(() => {
    tools_spy = spyOn(svc_claude, 'completeWithTools').mockResolvedValue('Here is the answer.');
});
afterEach(() => tools_spy.mockRestore());

const lastCall = (): ToolCall => tools_spy.mock.calls.at(-1)![0] as ToolCall;
const userTurn = (call: ToolCall): string => call.messages.at(-1)!.content as string;

describe('threads', () => {
    it('creates an empty thread titled "New chat"', () => {
        expect(createThread()).toMatchObject({ title: 'New chat', message_count: 0 });
    });

    it('lists most recently active first with message counts', async () => {
        const quiet = createThread();
        const busy = createThread();
        await sendMessage(busy.id, 'hello there');
        expect(listThreads().map((t) => [t.id, t.message_count])).toEqual([
            [busy.id, 2],
            [quiet.id, 0],
        ]);
    });

    it('getThread returns the thread and its messages oldest first; null when missing', async () => {
        const thread = createThread();
        await sendMessage(thread.id, 'first question');
        const found = getThread(thread.id)!;
        expect(found.thread.message_count).toBe(2);
        expect(found.messages.map((m) => [m.role, m.content])).toEqual([
            ['user', 'first question'],
            ['assistant', 'Here is the answer.'],
        ]);
        expect(getThread(999)).toBeNull();
    });

    it('delete cascades to the messages and is false for a missing thread', async () => {
        const thread = createThread();
        await sendMessage(thread.id, 'to be deleted');
        expect(deleteThread(thread.id)).toBe(true);
        expect(getThread(thread.id)).toBeNull();
        expect(repo_chat.selectChatMessages(thread.id)).toEqual([]);
        expect(deleteThread(thread.id)).toBe(false);
    });
});

describe('sendMessage', () => {
    it('returns { user, assistant } and stores both in order', async () => {
        const thread = createThread();
        const result = (await sendMessage(thread.id, '  What did David say?  '))!;
        expect(result.user).toMatchObject({ thread_id: thread.id, role: 'user', content: 'What did David say?' });
        expect(result.assistant).toMatchObject({ role: 'assistant', content: 'Here is the answer.' });
        expect(result.assistant.id).toBeGreaterThan(result.user.id);
    });

    it('is null for a missing thread and calls nothing', async () => {
        expect(await sendMessage(404, 'hi')).toBeNull();
        expect(tools_spy).not.toHaveBeenCalled();
    });

    it('names the thread from the first message (60 chars, whitespace collapsed) and only then', async () => {
        const thread = createThread();
        await sendMessage(thread.id, 'What   has David said\nabout my racing mind and the way I cannot sleep at night?');
        const title = getThread(thread.id)!.thread.title;
        expect(title).toBe('What has David said about my racing mind and the way I canno');
        expect(title.length).toBeLessThanOrEqual(60);
        await sendMessage(thread.id, 'A second question');
        expect(getThread(thread.id)!.thread.title).toBe(title);
    });

    it('uses the chat task with a cached persona + context pack, tools attached', async () => {
        const session = seedSession();
        const thread = createThread();
        await sendMessage(thread.id, 'anything');
        const call = lastCall();
        expect(call.task).toBe('chat');
        expect(call.system).toHaveLength(2);
        expect(call.system.every((b) => b.cache_control?.type === 'ephemeral')).toBe(true);
        expect(call.system[0]!.text).toBe(CHAT_PERSONA);
        expect(call.system[1]!.text).toContain(`[session #${session.id}]`);
        expect(call.tools.map((t) => t.name)).toEqual(['search_notes', 'read_session', 'read_journal_entry']);
    });

    it('persona asks for concrete dated instructions and for conflicts to be named with both dates', () => {
        expect(CHAT_PERSONA).toMatch(/concrete, dated practical instructions/);
        expect(CHAT_PERSONA).toMatch(/two sessions seem to conflict.*both dates/);
    });

    it('keeps the system prefix byte-identical between turns (so it caches)', async () => {
        seedSession();
        const thread = createThread();
        await sendMessage(thread.id, 'one');
        const first = JSON.stringify(lastCall().system);
        await sendMessage(thread.id, 'two');
        expect(JSON.stringify(lastCall().system)).toBe(first);
    });

    it('sends only the last 30 stored messages as history, plus the new user turn', async () => {
        const thread = createThread();
        for (let i = 0; i < 20; i++) repo_chat.insertChatExchange({ thread_id: thread.id, user_content: `q${i}`, assistant_content: `a${i}`, title: null });
        await sendMessage(thread.id, 'newest question');
        const messages = lastCall().messages;
        expect(messages).toHaveLength(HISTORY_LIMIT + 1);
        expect(messages[0]).toEqual({ role: 'user', content: 'q5' });
        expect(messages.at(-2)).toEqual({ role: 'assistant', content: 'a19' });
        expect(messages.at(-1)!.role).toBe('user');
    });

    it('does not store retrieved excerpts in history (only the raw question)', async () => {
        reindexDocument({ kind: 'session', ref_id: 1, occurred_at: '2026-09-11T12:00:00.000Z', title: 'Sleep', body: 'David suggested a worry list for insomnia.' });
        const thread = createThread();
        await sendMessage(thread.id, 'insomnia advice');
        await sendMessage(thread.id, 'and another thing');
        expect(lastCall().messages[0]).toEqual({ role: 'user', content: 'insomnia advice' });
    });

    it('adds "Possibly relevant excerpts" only when search finds something', async () => {
        const session = seedSession({ notes: 'We discussed the worry list and nothing else.' });
        const entry = seedJournal({ body: 'My worry list helped last night.' });
        reindexDocument({ kind: 'session', ref_id: session.id, occurred_at: session.occurred_at, title: 'Racing mind', body: 'David suggested a worry list.' });
        reindexDocument({ kind: 'journal', ref_id: entry.id, occurred_at: entry.occurred_at, title: 'Worry list', body: entry.body });
        const thread = createThread();

        await sendMessage(thread.id, 'tell me about the worry list');
        const hit_turn = userTurn(lastCall());
        expect(hit_turn).toContain('Possibly relevant excerpts');
        expect(hit_turn).toContain(`[session #${session.id}]`);
        expect(hit_turn).toContain(`[entry #${entry.id}]`);
        expect(hit_turn).toContain('Today is ');
        expect(hit_turn.startsWith('Today is ')).toBe(true);
        expect(hit_turn).toContain('tell me about the worry list');

        await sendMessage(thread.id, 'zxqvw plugh');
        const miss_turn = userTurn(lastCall());
        expect(miss_turn).not.toContain('Possibly relevant excerpts');
        expect(miss_turn).toContain('zxqvw plugh');
    });

    it('limits the leads to 5', async () => {
        for (let i = 1; i <= 8; i++) reindexDocument({ kind: 'session', ref_id: i, occurred_at: `2026-09-0${i}T12:00:00.000Z`, title: `Session ${i}`, body: 'meditation practice' });
        const thread = createThread();
        await sendMessage(thread.id, 'meditation');
        expect(userTurn(lastCall()).match(/- \[session #/g)).toHaveLength(5);
    });

    it('stores nothing when the model fails, so a retry does not duplicate the question', async () => {
        tools_spy.mockRejectedValue(new svc_claude.AiNotConfiguredError());
        const thread = createThread();
        await expect(sendMessage(thread.id, 'will fail')).rejects.toThrow('AI is not configured');
        expect(getThread(thread.id)).toMatchObject({ messages: [], thread: { title: 'New chat', message_count: 0 } });
    });

    it('rejects an empty reply', async () => {
        tools_spy.mockResolvedValue('');
        const thread = createThread();
        await expect(sendMessage(thread.id, 'hi')).rejects.toThrow('empty');
        expect(repo_chat.selectChatMessages(thread.id)).toEqual([]);
    });
});

describe('toHistory / titleFromMessage', () => {
    const row = (id: number, role: 'user' | 'assistant') => ({ id, thread_id: 1, role, content: `${role}${id}`, created_at: '' });

    it('drops a leading assistant message cut by the window so the API sees a user turn first', () => {
        expect(toHistory([row(2, 'assistant'), row(3, 'user'), row(4, 'assistant')]).map((m) => m.content)).toEqual(['user3', 'assistant4']);
        expect(toHistory([row(2, 'assistant')])).toEqual([]);
        expect(toHistory([])).toEqual([]);
    });

    it('falls back to "New chat" for a blank title', () => {
        expect(titleFromMessage('   ')).toBe('New chat');
        expect(titleFromMessage('short')).toBe('short');
    });
});
