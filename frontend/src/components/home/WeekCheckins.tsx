import { Check } from 'lucide-react';
import type { WeekDay } from './week';
import './home-week.css';

/* One focus item's "this week" row: seven 24px circles, Monday to Sunday, with the day letter
   above each. Today is ringed in the accent; a day that is done is filled with a check; past days
   and today toggle, future days are disabled. Each circle is a toggle button (aria-pressed) named
   by its full day ("Monday, Nov 2") inside a group named for the item, and the "3/7" count reads
   out as a sentence. */

type Props = { title: string; week: WeekDay[]; done: Set<string>; on_toggle: (day: string) => void };

export const WeekCheckins = ({ title, week, done, on_toggle }: Props) => {
    const count = week.filter((d) => done.has(d.day)).length;
    return (
        <div className="ta-week">
            <div role="group" aria-label={`This week: ${title}`} className="ta-week__days">
                {week.map((d) => {
                    const on = done.has(d.day);
                    const cls = `ta-week__day${on ? ' is-done' : ''}${d.is_today ? ' is-today' : ''}`;
                    return (
                        <button key={d.day} type="button" className={cls} aria-pressed={on} aria-label={d.long} disabled={d.is_future} onClick={() => on_toggle(d.day)}>
                            <span aria-hidden className="ta-week__letter">
                                {d.letter}
                            </span>
                            <span aria-hidden className="ta-week__circle">
                                {on && <Check />}
                            </span>
                        </button>
                    );
                })}
            </div>
            <span className="ta-week__count ta-num">
                <span aria-hidden>{count}/7</span>
                <span className="sr-only">{count} of 7 days done this week</span>
            </span>
        </div>
    );
};
