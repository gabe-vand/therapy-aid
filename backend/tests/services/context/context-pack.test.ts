import { beforeEach, describe, expect, it } from 'bun:test';
import { buildContextPack, buildProblemMappingContext, buildSummarizationContext, fitSessions } from '@/services/context/context-pack';
import { estimateTokens } from '@/services/context/format';
import { putProfile } from '@/services/settings/settings';
import { resetDatabase, seedFocus, seedJournal, seedProblem, seedSession, seedUpdate, summary } from '../../helpers/hlp-db';

// The pack against a real (in-memory) database: section order, what is included, the budget
// trimming, and byte-stability — the property prompt caching depends on.

const day = (n: number) => `2026-${String(Math.floor(n / 28) + 1).padStart(2, '0')}-${String((n % 28) + 1).padStart(2, '0')}T16:00:00.000Z`;

beforeEach(() => resetDatabase());

describe('buildContextPack', () => {
    it('renders the five sections in order, with explicit empty states on an empty database', () => {
        const pack = buildContextPack();
        const headings = pack.split('\n').filter((l) => l.startsWith('# '));
        expect(headings).toEqual(['# About Gabe', '# Current focus', '# Problems', '# Therapy sessions (newest first)', '# Recent journal entries (newest first)']);
        expect(pack).toContain('(No processed sessions yet.)');
    });

    it('includes ready sessions newest first and leaves out unfinished ones and discarded problems', () => {
        putProfile('Gabe is a CS student.');
        seedSession({ occurred_at: day(1), title: 'Older session' });
        seedSession({ occurred_at: day(2), title: 'Newer session' });
        seedSession({ occurred_at: day(3), title: 'Still summarizing', status: 'summarizing' });
        const p = seedProblem();
        seedUpdate(p.id, { body: 'First note' });
        seedProblem({ title: 'Dropped topic', status: 'discarded' });
        seedFocus({ headline: 'Protect your evenings.', items: [] });
        seedJournal({ body: 'Journal text here.' });

        const pack = buildContextPack();
        expect(pack).toContain('Gabe is a CS student.');
        expect(pack).toContain('Protect your evenings.');
        expect(pack).toContain('First note');
        expect(pack).toContain('Journal text here.');
        expect(pack.indexOf('Newer session')).toBeLessThan(pack.indexOf('Older session'));
        expect(pack).not.toContain('Still summarizing');
        expect(pack).not.toContain('Dropped topic');
    });

    it('keeps only the newest 8 journal entries', () => {
        for (let i = 0; i < 10; i++) seedJournal({ occurred_at: day(i), body: `entry-${i}` });
        const pack = buildContextPack();
        expect(pack).toContain('entry-9');
        expect(pack).toContain('entry-2');
        expect(pack).not.toContain('entry-1\n');
        expect(pack).not.toContain('entry-0');
    });

    it('is byte-identical across calls on the same data (so it caches)', () => {
        seedSession();
        seedProblem();
        seedJournal();
        expect(buildContextPack()).toBe(buildContextPack());
    });

    it('leaves out the excluded journal entry and still fills the 8 slots with others; unchanged when not passed', () => {
        const rows = Array.from({ length: 9 }, (_, i) => seedJournal({ occurred_at: day(i), body: `entry-${i}` }));
        const newest = rows[8]!;
        const without = buildContextPack({ exclude_entry_id: newest.id });
        expect(without).not.toContain('entry-8');
        expect(without).not.toContain(`[entry #${newest.id}]`);
        expect(without).toContain('entry-0');
        expect(buildContextPack()).toContain('entry-8');
        expect(buildContextPack()).toBe(buildContextPack({}));
    });

    it('degrades the OLDEST sessions to one line when over budget, newest stay full', () => {
        const long = summary({ overview: 'detail '.repeat(400) });
        for (let i = 0; i < 12; i++) seedSession({ occurred_at: day(i), title: `S${i}`, summary: long });

        const pack = buildContextPack({ budget_tokens: 6000 });
        expect(estimateTokens(pack)).toBeLessThanOrEqual(6000);
        expect(pack).toContain('## Older sessions (condensed — search for details)');
        expect(pack).toMatch(/## \w{3} \w{3} \d+, 2026 — S11 \[session #\d+\]/);
        expect(pack).toMatch(/^- .* — S0 \[session #\d+\]: Racing thoughts/m);
        expect(pack.indexOf('— S11')).toBeLessThan(pack.indexOf('— S0'));
        // Fits with nothing trimmed at the real budget.
        expect(buildContextPack()).not.toContain('Older sessions');
    });
});

describe('fitSessions', () => {
    it('drops the oldest one-liners, with a count, when even they do not fit', () => {
        const full = ['F'.repeat(400), 'F'.repeat(400), 'F'.repeat(400)];
        const lines = ['- newest', '- middle', '- oldest'].map((l) => `${l} ${'x'.repeat(200)}`);
        const text = fitSessions(full, lines, 150);
        expect(estimateTokens(text)).toBeLessThanOrEqual(150);
        expect(text).toContain('- newest');
        expect(text).toContain('- middle');
        expect(text).not.toContain('- oldest');
        expect(text).toContain('(1 older session omitted — use search to find them.)');
    });
});

describe('buildSummarizationContext', () => {
    it('has the profile, problems with ids, and the 3 most recent sessions before the given date', () => {
        putProfile('About me.');
        const p = seedProblem();
        const sessions = [0, 1, 2, 3, 4].map((i) => seedSession({ occurred_at: day(i), title: `S${i}` }));

        const ctx = buildSummarizationContext({ before: day(4), exclude_session_id: sessions[4]!.id });
        expect(ctx).toContain('About me.');
        expect(ctx).toContain(`[problem #${p.id}] (active) Racing mind at night`);
        expect(ctx).toContain('— S3 ');
        expect(ctx).toContain('— S1 ');
        expect(ctx).not.toContain('— S0 ');
        expect(ctx).not.toContain('— S4 ');
    });

    it('the mapping context lists active and resolved problems, not discarded', () => {
        seedProblem({ title: 'A' });
        seedProblem({ title: 'B', status: 'resolved' });
        seedProblem({ title: 'C', status: 'discarded' });
        const ctx = buildProblemMappingContext();
        expect(ctx).toContain('(active) A');
        expect(ctx).toContain('(resolved) B');
        expect(ctx).not.toContain(') C');
    });
});
