import { describe, expect, it } from 'bun:test';
import { toMatchQuery } from '@/services/search/sanitize';

describe('toMatchQuery', () => {
    it('quotes every term, prefix-matches longer ones, drops stopwords and ORs them', () => {
        expect(toMatchQuery('What has David said about my racing mind?')).toBe('"david"* OR "said"* OR "racing"* OR "mind"*');
    });

    it('neutralises FTS5 syntax: quotes, operators, column filters, NEAR, parentheses, stars', () => {
        const match = toMatchQuery('"panic" AND -sleep OR title:work NEAR(a b) (x* ^start');
        expect(match).toBe('"panic"* OR "sleep"* OR "title"* OR "work"* OR "near"* OR "start"*');
        expect(match).not.toMatch(/(^|\s)(AND|NOT|NEAR)(\s|$)/);
    });

    it('returns null when nothing searchable is left', () => {
        for (const text of ['', '   ', '"""', '?!', 'what is it', '* - ^ :']) expect(toMatchQuery(text)).toBeNull();
    });

    it('dedupes, lower-cases and caps the term count', () => {
        expect(toMatchQuery('Nicole nicole NICOLE')).toBe('"nicole"*');
        const many = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
        expect(toMatchQuery(many)!.split(' OR ')).toHaveLength(12);
    });

    it('keeps a contraction whole, so its head is not searched on its own', () => {
        expect(toMatchQuery("I don't feel safe at work")).toBe('"feel"* OR "safe"* OR "work"*');
        expect(toMatchQuery('isn’t it')).toBeNull();
        expect(toMatchQuery("Nicole's mornings")).toBe('"nicoles"* OR "mornings"*');
    });

    it('keeps non-ASCII letters and digits', () => {
        expect(toMatchQuery('café 2026')).toBe('"café"* OR "2026"*');
    });
});
