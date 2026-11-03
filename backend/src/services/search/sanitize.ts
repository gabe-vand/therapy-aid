// Turns free text (a chat message, a model's search_notes query) into a safe FTS5 MATCH
// expression. Raw user text is never handed to MATCH: a stray `"`, `*`, `-`, `:` or a bare
// AND/OR/NEAR is FTS5 syntax and would throw. Every term is quoted, so operators become plain
// words; stopwords are dropped; terms are OR-ed so a natural-language question still matches
// (bm25 ranks documents that hit more terms first). Apostrophes are removed before splitting, so a
// contraction stays one word ("don't" → "dont", a stopword) instead of leaving a rare, heavily
// weighted head ("don") that matches every note mentioning a Don.

// Words that would match nearly every document and only dilute bm25.
const STOPWORDS = new Set(
    (
        'a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its me my myself of on or our ' +
        'should so than that the their them then there these they this to up was we were what when where which who why will with would you your ' +
        'about after again all am any because before being both each few more most no nor not now off once only other out over own same she he ' +
        'some such too under until very just also get got im ive id dont doesnt didnt isnt arent wasnt werent cant couldnt wont wouldnt shouldnt ' +
        'havent hasnt hadnt youre youve theyre thats lets'
    ).split(' '),
);

// Terms this long or longer also match as a prefix ("panic" finds "panicking" even though the
// porter stems differ).
const PREFIX_MIN = 4;

/** The FTS5 MATCH expression for `text`, or null when nothing searchable is left. */
export const toMatchQuery = (text: string, max_terms = 12): string | null => {
    const words =
        text
            .toLowerCase()
            .replace(/['’]/g, '')
            .match(/[\p{L}\p{N}]+/gu) ?? [];
    const terms = [...new Set(words.filter((word) => word.length > 1 && !STOPWORDS.has(word)))].slice(0, max_terms);
    if (terms.length === 0) return null;
    return terms.map((term) => (term.length >= PREFIX_MIN ? `"${term}"*` : `"${term}"`)).join(' OR ');
};
