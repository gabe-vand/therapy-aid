import { describe, expect, it } from 'bun:test';
import { apiBase, localDay, occurredAt, splitDated } from '../../../scripts/lib/seed-parse';

// scripts/lib/seed-parse.ts is the importer's pure core; the CLI itself needs a live server.

describe('splitDated', () => {
    const md = ['# Journal', 'preamble that is dropped', '', '## 2026-10-13', 'Newest entry.', '', '### a sub-heading', 'still the same entry', '', '## 2026-08-06 — Intake', 'Oldest entry.', ''].join('\n');

    it('splits on dated headings, drops the preamble, and sorts oldest first', () => {
        const entries = splitDated(md);
        expect(entries.map((e) => e.date)).toEqual(['2026-08-06', '2026-10-13']);
        expect(entries[0]!.body).toBe('Oldest entry.');
        expect(entries[1]!.body).toBe('Newest entry.\n\n### a sub-heading\nstill the same entry');
    });

    it('treats other ## headings as body text, and handles CRLF', () => {
        const entries = splitDated('## 2026-01-02\r\nHello\r\n## Notes\r\nmore\r\n');
        expect(entries).toEqual([{ date: '2026-01-02', body: 'Hello\n## Notes\nmore' }]);
    });

    it('drops empty entries and merges a repeated date in file order', () => {
        const entries = splitDated('## 2026-03-01\n\n## 2026-03-02\nfirst\n## 2026-03-02\nsecond\n');
        expect(entries).toEqual([{ date: '2026-03-02', body: 'first\nsecond' }]);
    });

    it('returns [] when there are no dated headings, and rejects an impossible date', () => {
        expect(splitDated('just text\n## not a date\n')).toEqual([]);
        expect(() => splitDated('## 2026-02-31\nx')).toThrow(/calendar date/);
    });
});

describe('dates', () => {
    it('occurredAt is local noon on that day, and localDay reads it back', () => {
        const iso = occurredAt('2026-09-11');
        expect(new Date(iso).getHours()).toBe(12);
        expect(localDay(iso)).toBe('2026-09-11');
    });
});

describe('apiBase', () => {
    it('hits bare paths on localhost and /api on a tailnet host', () => {
        expect(apiBase('http://localhost:3010')).toBe('http://localhost:3010');
        expect(apiBase('http://127.0.0.1:3010/')).toBe('http://127.0.0.1:3010');
        expect(apiBase('https://therapy-aid.elephant-trench.ts.net')).toBe('https://therapy-aid.elephant-trench.ts.net/api');
        expect(apiBase('https://therapy-aid.elephant-trench.ts.net/')).toBe('https://therapy-aid.elephant-trench.ts.net/api');
    });

    it('never doubles /api and honours an explicit prefix', () => {
        expect(apiBase('https://x.ts.net/api')).toBe('https://x.ts.net/api');
        expect(apiBase('http://localhost:8080', '/api')).toBe('http://localhost:8080/api');
        expect(apiBase('https://x.ts.net', '')).toBe('https://x.ts.net');
    });
});
