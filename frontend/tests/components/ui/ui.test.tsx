import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { Card, Chip, Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';

describe('ui primitives', () => {
    it('Button defaults to type=button and carries its variant class', () => {
        render(<Button variant="primary">Save</Button>);
        const button = screen.getByRole('button', { name: 'Save' });
        expect(button).toHaveAttribute('type', 'button');
        expect(button.className).toContain('ta-btn--primary');
    });

    it('Card, Chip, Skeleton and Loading render', () => {
        const { container } = render(
            <Card>
                <Chip tone="warn">Stale</Chip>
                <Loading>
                    <Skeleton lines={3} />
                </Loading>
            </Card>,
        );
        expect(container.querySelector('.ta-card')).not.toBeNull();
        expect(screen.getByText('Stale').className).toContain('ta-chip--warn');
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(container.querySelectorAll('.ta-skeleton')).toHaveLength(3);
    });

    it('PageHeader / EmptyState / ErrorState show their content, and Retry calls back', () => {
        const retry = vi.fn();
        render(
            <>
                <PageHeader title="Sessions" subtitle="All of them" actions={<Button>New</Button>} />
                <EmptyState title="No sessions yet" body="Record one." />
                <ErrorState message="Cannot reach the server." on_retry={retry} />
            </>,
        );
        expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeInTheDocument();
        expect(screen.getByText('No sessions yet')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server.');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(retry).toHaveBeenCalledOnce();
    });

    it('ConfirmDialog confirms, cancels on Escape, and disables while busy', () => {
        const on_confirm = vi.fn();
        const on_cancel = vi.fn();
        const { rerender } = render(<ConfirmDialog open title="Delete this session?" confirm_label="Delete" on_confirm={on_confirm} on_cancel={on_cancel} />);
        expect(screen.getByRole('dialog', { name: 'Delete this session?' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(on_confirm).toHaveBeenCalledOnce();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(on_cancel).toHaveBeenCalledOnce();

        rerender(<ConfirmDialog open busy title="Delete this session?" confirm_label="Delete" on_confirm={on_confirm} on_cancel={on_cancel} />);
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
        rerender(<ConfirmDialog open={false} title="x" confirm_label="Delete" on_confirm={on_confirm} on_cancel={on_cancel} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
