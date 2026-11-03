import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdeaButton } from '@/components/journal/IdeaButton';
import { first_line, IDEA_GROWTH_CHARS, IDEA_MIN_CHARS, IDEA_PAUSE_MS, idea_visible, idea_wants_pulse } from '@/components/journal/idea-rules';

/* The "💡 I have an idea…" rules, exactly as SPEC §8 states them:
   hidden under 120 chars; pulses only after +200 chars since the last insight AND a 4s pause; never
   generates by itself (on_click fires only from a click). */

const text = (n: number) => 'x'.repeat(n);
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const button = () => screen.queryByRole('button', { name: /I have an idea/ });
const pulsing = () => button()?.getAttribute('data-pulsing') === 'true';

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('idea rules (pure)', () => {
    it('uses the specified thresholds', () => {
        expect([IDEA_MIN_CHARS, IDEA_GROWTH_CHARS, IDEA_PAUSE_MS]).toEqual([120, 200, 4000]);
        expect(idea_visible(119)).toBe(false);
        expect(idea_visible(120)).toBe(true);
        expect(idea_wants_pulse(319, 120)).toBe(false);
        expect(idea_wants_pulse(320, 120)).toBe(true);
    });

    it('previews an entry by its first non-empty line', () => {
        expect(first_line('\n\n  ## Rough night \nmore')).toBe('Rough night');
        expect(first_line('   ')).toBe('Untitled entry');
    });
});

describe('IdeaButton', () => {
    it('is hidden below 120 characters and visible from 120', () => {
        const { rerender } = render(<IdeaButton draft={text(119)} baseline={0} busy={false} on_click={() => {}} />);
        expect(button()).not.toBeInTheDocument();
        rerender(<IdeaButton draft={text(120)} baseline={0} busy={false} on_click={() => {}} />);
        expect(button()).toBeInTheDocument();
    });

    it('does not pulse when the draft has not grown 200 chars past the baseline, however long the pause', async () => {
        render(<IdeaButton draft={text(400)} baseline={250} busy={false} on_click={() => {}} />);
        await tick(60_000);
        expect(pulsing()).toBe(false);
    });

    it('does not pulse straight away: growth alone is not enough without the 4s pause', async () => {
        render(<IdeaButton draft={text(300)} baseline={0} busy={false} on_click={() => {}} />);
        await tick(IDEA_PAUSE_MS - 1);
        expect(pulsing()).toBe(false);
        await tick(1);
        expect(pulsing()).toBe(true);
    });

    it('keeps waiting while the writer keeps typing: each change restarts the 4s pause', async () => {
        const { rerender } = render(<IdeaButton draft={text(300)} baseline={0} busy={false} on_click={() => {}} />);
        await tick(3000);
        rerender(<IdeaButton draft={text(305)} baseline={0} busy={false} on_click={() => {}} />);
        await tick(3000);
        expect(pulsing()).toBe(false);
        await tick(1000);
        expect(pulsing()).toBe(true);
    });

    it('pulses once per baseline, and a new insight (new baseline) calms it', async () => {
        const { rerender } = render(<IdeaButton draft={text(300)} baseline={0} busy={false} on_click={() => {}} />);
        await tick(IDEA_PAUSE_MS);
        expect(pulsing()).toBe(true);

        rerender(<IdeaButton draft={text(300)} baseline={300} busy={false} on_click={() => {}} />);
        expect(pulsing()).toBe(false);
        await tick(60_000);
        expect(pulsing()).toBe(false);

        rerender(<IdeaButton draft={text(500)} baseline={300} busy={false} on_click={() => {}} />);
        await tick(IDEA_PAUSE_MS);
        expect(pulsing()).toBe(true);
    });

    it('never calls on_click by itself; only a click does', async () => {
        const on_click = vi.fn();
        render(<IdeaButton draft={text(900)} baseline={0} busy={false} on_click={on_click} />);
        await tick(120_000);
        expect(pulsing()).toBe(true);
        expect(on_click).not.toHaveBeenCalled();
        fireEvent.click(button()!);
        expect(on_click).toHaveBeenCalledTimes(1);
    });

    it('is disabled while busy and shows that it is thinking', () => {
        render(<IdeaButton draft={text(200)} baseline={0} busy on_click={() => {}} />);
        expect(screen.getByRole('button', { name: /Thinking it over/ })).toBeDisabled();
    });
});
