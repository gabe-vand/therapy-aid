import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import { CHAT_TOOLS, runChatTool } from '@/services/chat/tools';
import { createThread, sendMessage } from '@/services/chat/chat';
import { reindexJournalEntry, reindexSession } from '@/services/search/search';
import { installFakeClaude, message, text, toolUse, type FakeTransport } from '../../helpers/hlp-claude';
import { resetDatabase, seedJournal, seedSession, summary } from '../../helpers/hlp-db';

// The retrieval tools answer from real rows; bad ids throw so the loop reports is_error.

beforeEach(() => resetDatabase());

describe('tool definitions', () => {
    it('declare the three tools with required inputs', () => {
        expect(CHAT_TOOLS.map((t) => [t.name, t.input_schema.required])).toEqual([
            ['search_notes', ['query']],
            ['read_session', ['session_id']],
            ['read_journal_entry', ['entry_id']],
        ]);
    });
});

describe('search_notes', () => {
    it('returns handles, dates, titles and snippets from the real index', async () => {
        const session = seedSession({ notes: 'David said to try box breathing when the panic starts.' });
        reindexSession(session);
        const entry = seedJournal({ body: 'Tried box breathing on the bus.' });
        reindexJournalEntry(entry);

        const both = await runChatTool('search_notes', { query: 'box breathing' });
        expect(both).toContain(`[session #${session.id}]`);
        expect(both).toContain(`[entry #${entry.id}]`);
        expect(both).toContain('[breathing]');

        const only_journal = await runChatTool('search_notes', { query: 'box breathing', kind: 'journal' });
        expect(only_journal).toContain(`[entry #${entry.id}]`);
        expect(only_journal).not.toContain('[session #');
    });

    it('says so when nothing matches, and rejects a missing query', async () => {
        expect(await runChatTool('search_notes', { query: 'zxqvw' })).toContain('No matches');
        await expect(runChatTool('search_notes', {})).rejects.toThrow('Invalid tool input');
    });
});

describe('read_session', () => {
    it('returns the summary, David’s advice and the raw notes', async () => {
        const session = seedSession({ notes: 'Raw notes: talked about mornings.', summary: summary({ title: 'Mornings', therapist_advice: ['Same wake time daily'] }) });
        const result = await runChatTool('read_session', { session_id: session.id });
        expect(result).toContain(`# Mornings [session #${session.id}]`);
        expect(result).toContain('## What David suggested');
        expect(result).toContain('Same wake time daily');
        expect(result).toContain('Raw notes: talked about mornings.');
    });

    it('includes the transcript and cuts a huge one with a note', async () => {
        const session = seedSession({ source: 'recording', notes: null, transcript: `[00:01] Speaker 0: ${'word '.repeat(20_000)}` });
        const result = await runChatTool('read_session', { session_id: session.id });
        expect(result).toContain('## Transcript');
        expect(result).toContain('more characters not shown');
    });

    it('handles a session with no summary yet', async () => {
        const session = seedSession({ status: 'summarizing', summary: null, title: null, notes: null });
        expect(await runChatTool('read_session', { session_id: session.id })).toContain('no summary, notes or transcript yet');
    });

    it('throws for an unknown id and for a non-integer id', async () => {
        await expect(runChatTool('read_session', { session_id: 9999 })).rejects.toThrow('no session #9999');
        await expect(runChatTool('read_session', { session_id: 'abc' })).rejects.toThrow('Invalid tool input');
    });
});

describe('read_journal_entry', () => {
    it('returns the whole entry with its handle and date', async () => {
        const entry = seedJournal({ body: 'Long entry.\nSecond paragraph.' });
        const result = await runChatTool('read_journal_entry', { entry_id: entry.id });
        expect(result).toContain(`[entry #${entry.id}]`);
        expect(result).toContain('Second paragraph.');
    });

    it('throws for an unknown id', async () => {
        await expect(runChatTool('read_journal_entry', { entry_id: 9999 })).rejects.toThrow('no journal entry #9999');
    });
});

it('throws for an unknown tool', async () => {
    await expect(runChatTool('delete_everything', {})).rejects.toThrow('Unknown tool');
});

describe('through the real tool loop (fake transport)', () => {
    let fake: FakeTransport;
    afterEach(() => fake.restore());

    const toolResults = (request: { messages: Anthropic.MessageParam[] }): Anthropic.ToolResultBlockParam[] => request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];

    it('returns real data for a good id and is_error for a bad one, all in ONE user message', async () => {
        const session = seedSession({ summary: summary({ title: 'Mornings' }) });
        fake = installFakeClaude([message([toolUse('t1', 'read_session', { session_id: session.id }), toolUse('t2', 'read_session', { session_id: 9999 })], 'tool_use'), message([text('Per your Mornings session, David wants a steady wake time.')])]);
        const thread = createThread();
        const result = (await sendMessage(thread.id, 'what did we say about mornings?'))!;

        expect(result.assistant.content).toBe('Per your Mornings session, David wants a steady wake time.');
        expect(fake.requests).toHaveLength(2);
        const results = toolResults(fake.requests[1] as never);
        expect(results.map((r) => r.tool_use_id)).toEqual(['t1', 't2']);
        expect(results[0]!.is_error).toBeUndefined();
        expect(String(results[0]!.content)).toContain('# Mornings');
        expect(results[1]!.is_error).toBe(true);
        expect(String(results[1]!.content)).toContain('no session #9999');
    });

    it('sends the chat route (sonnet, medium) with cached system blocks and the tools', async () => {
        fake = installFakeClaude([message([text('ok')])]);
        const thread = createThread();
        await sendMessage(thread.id, 'hi');
        const request = fake.requests[0]!;
        expect(request.model).toBe('claude-sonnet-5-5');
        expect(request.output_config?.effort).toBe('medium');
        expect(request.tools?.map((t) => ('name' in t ? t.name : ''))).toEqual(['search_notes', 'read_session', 'read_journal_entry']);
        expect((request.system as { cache_control?: unknown }[]).filter((b) => b.cache_control)).toHaveLength(2);
    });
});
