/* Cleans up what TipTap's Markdown serializer writes before it is stored. The serializer
   HTML-encodes every &, < and > in plain text ("Tom &amp; Jerry"), which renders fine but leaks
   into the list preview, full-text search and the AI context pack. This decodes them back
   wherever the bare character cannot change the meaning of the Markdown:
   - &amp; unless it would then spell an entity (&amp;copy; must stay literal);
   - &lt; unless a tag, comment or closing tag could start after it;
   - &gt; unless only block markers precede it on the line (it would become a quote). */

export const tidy_markdown = (markdown: string): string =>
    markdown
        .replace(/&amp;(?!#\d+;|#x[0-9a-f]+;|[a-z][a-z0-9]*;)/gi, '&')
        .replace(/&lt;(?![a-z/!?])/gi, '<')
        .replace(/(?<!^[\s>*+\-\d.)]*)&gt;/gm, '>');
