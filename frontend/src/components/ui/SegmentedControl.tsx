import type { ReactNode } from 'react';
import './ui.css';

/* A 2–4 way choice shown as one recessed track (the theme switch, filters…). Each option is a
   toggle button with aria-pressed inside a labelled group, so a screen reader hears the group
   name and which option is pressed. With `icon_only` each option's label moves to aria-label +
   title and only its icon shows (the sidebar's compact theme switch). */

export type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode };

type Props<T extends string> = { label: string; options: SegmentOption<T>[]; value: T; on_change: (value: T) => void; icon_only?: boolean; block?: boolean; className?: string };

export const SegmentedControl = <T extends string>({ label, options, value, on_change, icon_only = false, block = false, className }: Props<T>) => (
    <div role="group" aria-label={label} className={`ta-seg${block ? ' ta-seg--block' : ''}${className ? ` ${className}` : ''}`}>
        {options.map((opt) => (
            <button key={opt.value} type="button" className="ta-seg__opt" aria-pressed={opt.value === value} aria-label={icon_only ? opt.label : undefined} title={icon_only ? opt.label : undefined} onClick={() => on_change(opt.value)}>
                {opt.icon}
                {!icon_only && opt.label}
            </button>
        ))}
    </div>
);
