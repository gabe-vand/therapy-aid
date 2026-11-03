import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_insights from '@/repositories/journal-insights';
import { createEntry, deleteEntry, getEntry, listEntries, listInsights, updateEntry } from '@/services/journal/journal';
import * as search from '@/services/search/search';
import { resetDatabase, seedJournal } from '../../helpers/hlp-db';

// Journal CRUD: every write keeps the search index in step, the list carries insight counts.

beforeEach(() => resetDatabase());

let reindex: ReturnType<typeof spyOn>;
let remove: ReturnType<typeof spyOn>;
beforeEach(() => {
    reindex = spyOn(search, 'reindexJournalEntry');
    remove = spyOn(search, 'removeDocument');
});
afterEach(() => {
    reindex.mockRestore();
    remove.mockRestore();
});

describe('createEntry', () => {
    it('stores the entry, indexes it and reports zero insights', () => {
        const entry = createEntry({ occurred_at: '2026-10-13T16:00:00.000Z', body: 'Woke up at 4am again.\nMind racing.' });
        expect(entry).toMatchObject({ occurred_at: '2026-10-13T16:00:00.000Z', body: 'Woke up at 4am again.\nMind racing.', insight_count: 0 });
        expect(reindex).toHaveBeenCalledTimes(1);
        expect(search.searchDocuments('racing').map((h) => [h.kind, h.ref_id])).toEqual([['journal', entry.id]]);
    });

    it('defaults occurred_at to now and allows an empty body (the editor autosaves into it)', () => {
        const before = Date.now();
        const entry = createEntry({ body: '' });
        expect(new Date(entry.occurred_at).getTime()).toBeGreaterThanOrEqual(before);
        expect(entry.body).toBe('');
    });
});

describe('updateEntry', () => {
    it('applies the patch, bumps updated_at and reindexes with the new text', () => {
        const row = seedJournal({ body: 'Quiet day.' });
        reindex.mockClear();
        const entry = updateEntry(row.id, { body: 'Panic before the exam.' })!;
        expect(entry.body).toBe('Panic before the exam.');
        expect(entry.occurred_at).toBe(row.occurred_at);
        expect(entry.updated_at >= row.updated_at).toBe(true);
        expect(reindex).toHaveBeenCalledTimes(1);
        expect(search.searchDocuments('exam').map((h) => h.ref_id)).toEqual([row.id]);
        expect(search.searchDocuments('quiet')).toEqual([]);
    });

    it('changes only the date when only the date is sent', () => {
        const row = seedJournal({ body: 'Same text.' });
        expect(updateEntry(row.id, { occurred_at: '2026-01-02T12:00:00.000Z' })).toMatchObject({ body: 'Same text.', occurred_at: '2026-01-02T12:00:00.000Z' });
    });

    it('is null for a missing entry and does not touch the index', () => {
        expect(updateEntry(999, { body: 'x' })).toBeNull();
        expect(reindex).not.toHaveBeenCalled();
    });
});

describe('listEntries / getEntry', () => {
    it('lists newest first with insight counts', () => {
        const older = seedJournal({ occurred_at: '2026-10-01T12:00:00.000Z', body: 'older' });
        const newer = seedJournal({ occurred_at: '2026-10-09T12:00:00.000Z', body: 'newer' });
        repo_insights.insertJournalInsight({ entry_id: older.id, body: 'one', kind: 'reflection', source: 'reflection' });
        repo_insights.insertJournalInsight({ entry_id: older.id, body: 'two', kind: 'reflection', source: 'reflection' });
        expect(listEntries().map((e) => [e.id, e.insight_count])).toEqual([
            [newer.id, 0],
            [older.id, 2],
        ]);
        expect(getEntry(older.id)?.insight_count).toBe(2);
    });

    it('getEntry is null for a missing id', () => {
        expect(getEntry(404)).toBeNull();
    });
});

describe('deleteEntry', () => {
    it('removes the entry, its insights and its index row', () => {
        const row = seedJournal({ body: 'Delete me, panicking.' });
        repo_insights.insertJournalInsight({ entry_id: row.id, body: 'insight', kind: 'reflection', source: 'reflection' });
        expect(deleteEntry(row.id)).toBe(true);
        expect(remove).toHaveBeenCalledWith('journal', row.id);
        expect(getEntry(row.id)).toBeNull();
        expect(repo_insights.selectInsightsForEntry(row.id)).toEqual([]);
        expect(search.searchDocuments('panicking')).toEqual([]);
    });

    it('is false for a missing entry', () => {
        expect(deleteEntry(404)).toBe(false);
        expect(remove).not.toHaveBeenCalled();
    });
});

describe('listInsights', () => {
    it('returns the history newest first, [] for an entry with none, null for a missing entry', () => {
        const row = seedJournal();
        expect(listInsights(row.id)).toEqual([]);
        repo_insights.insertJournalInsight({ entry_id: row.id, body: 'first', kind: 'reflection', source: 'reflection' });
        repo_insights.insertJournalInsight({ entry_id: row.id, body: 'second', kind: 'reflection', source: 'reflection' });
        expect(listInsights(row.id)!.map((i) => i.body)).toEqual(['second', 'first']);
        expect(listInsights(999)).toBeNull();
    });
});
