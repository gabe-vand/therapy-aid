import type { HTMLAttributes } from 'react';
import './ui.css';

/* The width wrapper every page renders itself in — the fix for "everything is crunched in the
   middle". The shell's <main> is full-bleed; the page picks its own measure:
   - reading: 760px column for one thing to read or fill in (details, forms, settings);
   - wide: 1120px for lists and dashboards;
   - full: no max-width and no padding, the whole main height on desktop, for split-pane screens
     (Journal, Chat) whose panes scroll on their own.
   Padding is 32px/40px on desktop and 20px/16px on phones (ui-layout.css). */

export type PageWidth = 'reading' | 'wide' | 'full';

type Props = HTMLAttributes<HTMLDivElement> & { width?: PageWidth };

export const Page = ({ width = 'wide', className, ...rest }: Props) => <div className={`ta-page ta-page--${width}${className ? ` ${className}` : ''}`} {...rest} />;
