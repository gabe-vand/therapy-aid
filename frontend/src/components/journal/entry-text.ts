/* Plain-text helpers over stored Markdown: entries are saved as Markdown, so the syntax is
   stripped before a human sees a preview or a count, and before a paragraph is sent off to be
   classified for a margin note (paragraphs.ts builds on these). Pure functions, no DOM. */

/* One line of Markdown as plain text: block markers (#, >, -, *, +, 1.) at the start, emphasis
   marks (*, _, ~~) and backslash escapes anywhere, and [link](url) reduced to its text. */
export const strip_markdown = (line: string): string =>
    line
        .trim()
        .replace(/^(?:>\s*)+/, '')
        .replace(/^#{1,6}\s+/, '')
        .replace(/^(?:[-*_]\s*){3,}$/, '') // a horizontal rule
        .replace(/^(?:[-*+]|\d+[.)])(?:\s+|$)/, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|~~|\*|_)(?=\S)([\s\S]*?\S)\1/g, '$2')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\\([\\`*_[\]~#>+\-.!])/g, '$1')
        .trim();

/* First non-empty line of an entry, as plain text — the list's one-line preview. */
export const first_line = (body: string): string => {
    const line = body.split('\n').find((l) => strip_markdown(l) !== '');
    return line ? strip_markdown(line) : 'Untitled entry';
};

/* How many characters a reader would count: the text without Markdown syntax or line breaks. */
export const plain_length = (body: string): number => body.split('\n').reduce((n, line) => n + strip_markdown(line).length, 0);
