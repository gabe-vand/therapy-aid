import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { getEntry } from '@/services/journal/journal';
import { generateInsight } from '@/services/journal/insights';
import * as svc_claude from '@/services/common/svc-claude';
import { INSIGHT_PERSONA } from '@/services/journal/prompts';
import { searchDocuments } from '@/services/search/search';
import { installFakeClaude, message, text, type FakeTransport } from '../../helpers/hlp-claude';
import { resetDatabase, seedFocus, seedJournal, seedSession } from '../../helpers/hlp-db';

// "I have an idea…": the draft is saved first, then one structured call; nothing runs unless asked.

beforeEach(() => resetDatabase());

describe('generateInsight (svc-claude stubbed)', () => {
    let structured: ReturnType<typeof spyOn>;
    beforeEach(() => {
        structured = spyOn(svc_claude, 'completeStructured').mockResolvedValue({ body: 'You keep circling the same worry. In your Sept 11 session David said to write a worry list.' } as never);
    });
    afterEach(() => structured.mockRestore());

    it('saves the draft as the entry body, reindexes it, then stores the generated note', async () => {
        const entry = seedJournal({ body: 'old text' });
        const insight = (await generateInsight(entry.id, 'Brand new draft about insomnia.'))!;

        expect(insight).toMatchObject({ entry_id: entry.id, body: expect.stringContaining('worry list') });
        expect(getEntry(entry.id)).toMatchObject({ body: 'Brand new draft about insomnia.', insight_count: 1 });
        expect(searchDocuments('insomnia').map((h) => h.ref_id)).toEqual([entry.id]);
    });

    it('keeps the saved draft even when the AI call fails', async () => {
        structured.mockRejectedValue(new svc_claude.AiNotConfiguredError());
        const entry = seedJournal({ body: 'old' });
        await expect(generateInsight(entry.id, 'The draft I must not lose')).rejects.toThrow('AI is not configured');
        expect(getEntry(entry.id)).toMatchObject({ body: 'The draft I must not lose', insight_count: 0 });
    });

    it('asks on the insight task with a cached persona + pack, and the draft in the user message', async () => {
        const session = seedSession();
        seedFocus({ headline: 'Sleep first', items: [] });
        const other = seedJournal({ occurred_at: '2026-10-10T12:00:00.000Z', body: 'Rough week.\nMore.' });
        const entry = seedJournal({ occurred_at: '2026-10-13T12:00:00.000Z', body: 'x' });

        await generateInsight(entry.id, 'I think the mornings are the problem.');
        const call = structured.mock.calls[0]![0] as Parameters<typeof svc_claude.completeStructured>[0];

        expect(call.task).toBe('insight');
        expect(call.system).toHaveLength(2);
        expect(call.system.every((block) => block.cache_control?.type === 'ephemeral')).toBe(true);
        expect(call.system[0]!.text).toBe(INSIGHT_PERSONA);
        expect(call.system[1]!.text).toContain(`[session #${session.id}]`);
        expect(call.system[1]!.text).toContain('Sleep first');

        const user = call.messages[0]!.content as string;
        expect(call.messages).toHaveLength(1);
        expect(user).toContain('I think the mornings are the problem.');
        expect(user).toContain(`[entry #${entry.id}]`);
        expect(user).toContain(`[entry #${other.id}]: Rough week.`);
        expect(user).toContain('Today is ');
        expect(call.system.map((b) => b.text).join('')).not.toContain('Today is ');
    });

    it('lists at most the 3 most recent OTHER entries as pointers', async () => {
        const rows = [1, 2, 3, 4, 5].map((d) => seedJournal({ occurred_at: `2026-10-0${d}T12:00:00.000Z`, body: `Entry day ${d}` }));
        const target = rows[4]!;
        await generateInsight(target.id, 'draft');
        const user = (structured.mock.calls[0]![0] as { messages: { content: string }[] }).messages[0]!.content;
        expect(user).not.toContain(`[entry #${target.id}]: Entry`);
        expect(user).toContain('Entry day 4');
        expect(user).toContain('Entry day 3');
        expect(user).toContain('Entry day 2');
        expect(user).not.toContain('Entry day 1');
    });

    it('is null (and calls nothing) for a missing entry', async () => {
        expect(await generateInsight(404, 'draft')).toBeNull();
        expect(structured).not.toHaveBeenCalled();
    });

    it('rejects an empty reply instead of storing a blank insight', async () => {
        structured.mockResolvedValue({ body: '   ' } as never);
        const entry = seedJournal();
        await expect(generateInsight(entry.id, 'draft')).rejects.toThrow('empty');
        expect(getEntry(entry.id)?.insight_count).toBe(0);
    });
});

describe('generateInsight (fake transport)', () => {
    let fake: FakeTransport;
    afterEach(() => fake.restore());

    it('sends a structured request on the insight route with cache_control on both system blocks', async () => {
        fake = installFakeClaude([message([text(JSON.stringify({ body: 'A note from the model.' }))])]);
        const entry = seedJournal();
        const insight = await generateInsight(entry.id, 'Some draft.');

        expect(insight?.body).toBe('A note from the model.');
        const request = fake.requests[0]!;
        expect(request.model).toBe('claude-sonnet-5-5');
        expect(request.output_config?.effort).toBe('high');
        expect((request.system as { cache_control?: unknown }[]).map((b) => !!b.cache_control)).toEqual([true, true]);
        expect(JSON.stringify(request)).not.toContain('"thinking"');
    });
});
