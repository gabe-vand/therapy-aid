import ReactMarkdown, { type Components } from 'react-markdown';
import './markdown.css';

/* Renders model-written markdown (session overviews, insights, chat answers) with the app's
   typography. react-markdown with no plugins: raw HTML in the text is NOT rendered (it shows as
   text), so model output can never inject markup. Links open in a new tab. */

const components: Components = {
    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
};

export const Markdown = ({ text, className = '' }: { text: string; className?: string }) => (
    <div className={`ta-md ${className}`.trim()}>
        <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
);
