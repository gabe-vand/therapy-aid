import { describe, expect, it } from 'vitest';
import { tidy_markdown } from '@/components/journal/markdown-text';
import { first_line, plain_length, strip_markdown } from '@/components/journal/entry-text';

/* What gets stored and previewed: TipTap's entity-encoded &, <, > come back as plain characters
   wherever that cannot change the Markdown, and previews/counts ignore Markdown syntax. */

describe('tidy_markdown', () => {
    it('decodes &, < and > in ordinary text', () => {
        expect(tidy_markdown('Tom &amp; Jerry, i &lt;3 you, 5 &gt; 3')).toBe('Tom & Jerry, i <3 you, 5 > 3');
    });

    it('keeps the encoding where the bare character would mean something else', () => {
        expect(tidy_markdown('&amp;copy; and &amp;#169;')).toBe('&amp;copy; and &amp;#169;');
        expect(tidy_markdown('&lt;b&gt;not html&lt;/b&gt;')).toBe('&lt;b>not html&lt;/b>');
        expect(tidy_markdown('&gt; not a quote\n- &gt; nor here')).toBe('&gt; not a quote\n- &gt; nor here');
    });
});

describe('plain-text previews', () => {
    it('strips block markers, emphasis, links and escapes', () => {
        expect(strip_markdown('> ## **Big** _day_ [link](https://x.y) 2 \\* 3')).toBe('Big day link 2 * 3');
        expect(strip_markdown('1. first')).toBe('first');
        expect(first_line('\n---\n- \n- item one')).toBe('item one');
    });

    it('counts characters without syntax or line breaks', () => {
        expect(plain_length('# Hi\n\n- **yo**')).toBe(4);
    });
});
