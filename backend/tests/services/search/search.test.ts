import { beforeEach, describe, expect, it } from 'bun:test';
import * as repo_search from '@/repositories/search';
import { rebuildSearchIndex, rebuildSearchIndexIfEmpty, reindexDocument, reindexJournalEntry, reindexSession, removeDocument, searchDocuments, sessionSearchDocument } from '@/services/search/search';
import { resetDatabase, seedJournal, seedSession, summary } from '../../helpers/hlp-db';

// The search service on a real FTS5 table: ranking, snippets, kind filters, hostile input, and
// the boot-time rebuild.

beforeEach(() => resetDatabase());

const doc = (ref_id: number, title: string, body: string, kind: 'session' | 'journal' = 'session') => ({ kind, ref_id, occurred_at: `2026-09-${String(ref_id).padStart(2, '0')}T12:00:00.000Z`, title, body });

describe('searchDocuments', () => {
    beforeEach(() => {
        reindexDocument(doc(1, 'Racing mind', 'David suggested a worry list before bed for the racing mind.'));
        reindexDocument(doc(2, 'Work stress', 'Deadlines at work; panicking before the standup meeting.'));
        reindexDocument(doc(3, 'Bad night', 'My mind would not stop racing again.', 'journal'));
    });

    it('returns hits best first, with a bracketed snippet', () => {
        const hits = searchDocuments('racing mind');
        expect(hits.map((h) => [h.kind, h.ref_id])).toEqual([
            ['session', 1],
            ['journal', 3],
        ]);
        expect(hits[0]!.snippet).toContain('[racing]');
        expect(hits[0]!.title).toBe('Racing mind');
        expect(typeof hits[0]!.ref_id).toBe('number');
    });

    it('stems and prefix-matches ("panic" finds "panicking")', () => {
        expect(searchDocuments('panic').map((h) => h.ref_id)).toEqual([2]);
    });

    it('filters by kind and honours the limit', () => {
        expect(searchDocuments('racing', { kind: 'journal' }).map((h) => h.ref_id)).toEqual([3]);
        expect(searchDocuments('racing mind work', { limit: 1 })).toHaveLength(1);
    });

    it('never throws on FTS5 syntax in the query', () => {
        for (const q of ['"', 'racing"', 'AND', 'NEAR(', 'mind*"', "it's", '-', 'title:racing', '(((']) expect(() => searchDocuments(q)).not.toThrow();
        expect(searchDocuments('"racing')[0]!.ref_id).toBe(1);
        expect(searchDocuments('?!')).toEqual([]);
    });

    it('replaces a document on reindex and drops it on remove', () => {
        reindexDocument(doc(2, 'Work stress', 'Now about sleep only.'));
        expect(searchDocuments('panic')).toEqual([]);
        expect(repo_search.countSearchDocuments()).toBe(3);
        removeDocument('session', 1);
        expect(searchDocuments('worry')).toEqual([]);
    });
});

describe('session and journal documents', () => {
    it('indexes a session by title, summary, advice, notes and transcript', () => {
        const row = seedSession({ summary: summary({ therapist_advice: ['Box breathing for four minutes'] }), transcript: '[00:01] Speaker 0: tell me about Nicole' });
        const d = sessionSearchDocument(row);
        expect(d).toMatchObject({ kind: 'session', ref_id: row.id, title: row.title });
        reindexSession(row);
        expect(searchDocuments('box breathing')[0]!.ref_id).toBe(row.id);
        expect(searchDocuments('Nicole')[0]!.ref_id).toBe(row.id);
    });

    it('titles a journal entry by its first non-empty line', () => {
        const entry = seedJournal({ body: '\n\nFelt calmer today.\nWalked to class.' });
        reindexJournalEntry(entry);
        expect(searchDocuments('walked', { kind: 'journal' })[0]).toMatchObject({ ref_id: entry.id, title: 'Felt calmer today.' });
    });
});

describe('rebuildSearchIndex', () => {
    it('refills the index from sessions and journal entries', () => {
        seedSession();
        seedSession({ status: 'uploaded', summary: null, notes: 'Unprocessed notes about the move.' });
        seedJournal();
        expect(rebuildSearchIndex()).toBe(3);
        expect(searchDocuments('move').length).toBe(1);
        expect(rebuildSearchIndex()).toBe(3);
        expect(repo_search.countSearchDocuments()).toBe(3);
    });

    it('IfEmpty rebuilds only an empty index, and reports nothing to do on an empty database', () => {
        expect(rebuildSearchIndexIfEmpty()).toBeNull();
        seedJournal();
        expect(rebuildSearchIndexIfEmpty()).toBe(1);
        seedJournal({ body: 'second' });
        expect(rebuildSearchIndexIfEmpty()).toBeNull();
        expect(repo_search.countSearchDocuments()).toBe(1);
    });
});
