import { beforeEach, describe, expect, it } from 'bun:test';
import * as repo_focus from '@/repositories/focus';
import * as repo_journal from '@/repositories/journal';
import * as repo_search from '@/repositories/search';
import * as repo_settings from '@/repositories/settings';
import { resetDatabase, seedFocus, seedJournal } from '../helpers/hlp-db';

beforeEach(() => resetDatabase());

describe('journal repository', () => {
    it('inserts, reads, lists newest first (limited), updates and deletes', () => {
        const a = seedJournal({ occurred_at: '2026-01-01T00:00:00.000Z', body: 'a' });
        const b = seedJournal({ occurred_at: '2026-02-01T00:00:00.000Z', body: 'b' });
        expect(repo_journal.selectJournalEntryById(a.id)).toEqual(a);
        expect(repo_journal.selectJournalEntries().map((e) => e.id)).toEqual([b.id, a.id]);
        expect(repo_journal.selectJournalEntries(1).map((e) => e.id)).toEqual([b.id]);
        // exclude_id drops that entry BEFORE the limit, so the cap still counts only other entries.
        expect(repo_journal.selectJournalEntries(1, b.id).map((e) => e.id)).toEqual([a.id]);
        expect(repo_journal.selectJournalEntries(undefined, a.id).map((e) => e.id)).toEqual([b.id]);
        expect(repo_journal.selectAllJournalEntries().map((e) => e.id)).toEqual([a.id, b.id]);
        expect(repo_journal.updateJournalEntry(a.id, { body: 'edited' })!.body).toBe('edited');
        expect(repo_journal.updateJournalEntry(9999, { body: 'x' })).toBeNull();
        repo_journal.deleteJournalEntry(a.id);
        expect(repo_journal.selectJournalEntryById(a.id)).toBeNull();
    });
});

describe('focus repository', () => {
    it('returns the newest snapshot, or null before the first', () => {
        expect(repo_focus.selectLatestFocusSnapshot()).toBeNull();
        seedFocus({ headline: 'first', items: [] });
        const second = seedFocus({ headline: 'second', items: [] });
        expect(repo_focus.selectLatestFocusSnapshot()!.id).toBe(second.id);
    });
});

describe('settings repository', () => {
    it('upserts idempotently', () => {
        expect(repo_settings.selectSetting('profile')).toBeNull();
        repo_settings.upsertSetting('profile', 'one');
        repo_settings.upsertSetting('profile', 'two');
        expect(repo_settings.selectSetting('profile')!.value).toBe('two');
    });
});

describe('search repository', () => {
    it('replaces one row per (kind, ref_id), filters by kind, counts and clears', () => {
        const doc = { kind: 'journal' as const, ref_id: 7, occurred_at: '2026-01-01T00:00:00.000Z', title: 'Calm', body: 'a calm walk' };
        repo_search.replaceSearchDocument(doc);
        repo_search.replaceSearchDocument({ ...doc, body: 'a calm swim' });
        repo_search.replaceSearchDocument({ ...doc, kind: 'session' });
        expect(repo_search.countSearchDocuments()).toBe(2);
        expect(repo_search.searchIndex('"swim"', 'journal', 5)).toEqual([{ kind: 'journal', ref_id: 7, occurred_at: doc.occurred_at, title: 'Calm', snippet: 'a calm [swim]' }]);
        expect(repo_search.searchIndex('"calm"', null, 5)).toHaveLength(2);
        repo_search.deleteSearchDocument('session', 7);
        expect(repo_search.countSearchDocuments()).toBe(1);
        repo_search.clearSearchIndex();
        expect(repo_search.countSearchDocuments()).toBe(0);
    });
});
