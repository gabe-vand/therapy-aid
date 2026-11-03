import { Link } from 'react-router-dom';
import type { DashboardTheme } from '@therapy-aid/shared';
import { Bar } from '@/components/ui/Bar';
import { Card } from '@/components/ui/Card';
import { paths } from '@/services/paths';
import './home.css';

/* "In your journal lately": the problems the journal's margin notes tied paragraphs to in the last
   30 days, as a bar list (the top theme sets the scale). Each row links to the problem. Home only
   renders it when there is at least one theme. */

export const JournalThemes = ({ themes }: { themes: DashboardTheme[] }) => {
    const max = Math.max(1, ...themes.map((t) => t.mentions));
    return (
        <section aria-labelledby="themes-title" className="ta-home-block">
            <div className="ta-block-head">
                <h2 id="themes-title" className="ta-eyebrow">
                    In your journal lately
                </h2>
                <span className="ta-block-head__meta">mentions, last 30 days</span>
            </div>
            <Card padded={false} className="overflow-hidden">
                <ul className="ta-themes">
                    {themes.map((t) => (
                        <li key={t.problem_id}>
                            <Link to={paths.problem(t.problem_id)} className="ta-theme">
                                <span className="ta-theme__title">{t.title}</span>
                                <Bar value={t.mentions} max={max} className="ta-theme__bar" />
                                <span className="ta-theme__count ta-num">
                                    {t.mentions}
                                    <span className="sr-only"> mentions</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </Card>
        </section>
    );
};
