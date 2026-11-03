import type { HTMLAttributes, ReactNode } from 'react';
import './ui.css';

/* Surfaces, labels and loading placeholders shared by every page: a Card (hairline border,
   --r-lg radius, 20/24px padding — only where a surface genuinely groups something), a Chip
   (small status label in one of five tones) and a Skeleton (shimmering placeholder block that
   matches the shape of what is loading). */

type CardProps = HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'div'; padded?: boolean };

export const Card = ({ as: Tag = 'section', padded = true, className, ...rest }: CardProps) => <Tag className={`ta-card${padded ? ' ta-card--padded' : ''}${className ? ` ${className}` : ''}`} {...rest} />;

export type ChipTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

export const Chip = ({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) => <span className={`ta-chip ta-chip--${tone}`}>{children}</span>;

/* `lines` stacked bars (the last one shorter, like a paragraph), or one block of `height`. */
export const Skeleton = ({ lines, height = 16, className = '' }: { lines?: number; height?: number; className?: string }) => {
    if (!lines) return <div aria-hidden className={`ta-skeleton ${className}`} style={{ height }} />;
    return (
        <div aria-hidden className={`flex flex-col gap-2 ${className}`}>
            {Array.from({ length: lines }, (_, i) => (
                <div key={i} className="ta-skeleton" style={{ height, width: i === lines - 1 && lines > 1 ? '60%' : '100%' }} />
            ))}
        </div>
    );
};

/* A loading region for screen readers: renders `children` (skeletons) with role=status. */
export const Loading = ({ label = 'Loading…', children }: { label?: string; children: ReactNode }) => (
    <div role="status" aria-label={label}>
        {children}
    </div>
);
