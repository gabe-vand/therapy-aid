import './ui.css';

/* A row of small dots, one per slot: filled (accent) where `marks[i]` is true, a hollow ring
   otherwise. The shape behind "which sessions touched this problem" on Home and Problems. It is
   one image to a screen reader (`label` says what the row means, e.g. "Discussed in 3 of 8
   sessions"); `titles` give each dot a hover tooltip (the session's date and title). */

type Props = { marks: boolean[]; label: string; titles?: string[]; className?: string };

export const Dots = ({ marks, label, titles, className }: Props) => (
    <span role="img" aria-label={label} className={`ta-dots${className ? ` ${className}` : ''}`}>
        {marks.map((on, i) => (
            <span key={i} title={titles?.[i]} className={`ta-dot${on ? ' ta-dot--on' : ''}`} />
        ))}
    </span>
);
