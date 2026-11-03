import { Card } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import './settings.css';

/* Appearance: the same light / dark / system switch as the sidebar, spelled out with labels.
   Both toggles share useTheme, so changing one moves the other. */
export const AppearanceCard = () => (
    <Card aria-labelledby="appearance-title">
        <h2 id="appearance-title" className="ta-set-title">
            Appearance
        </h2>
        <p className="ta-set-desc">Light, dark, or follow your device.</p>
        <div className="ta-set-section">
            <ThemeToggle show_labels block />
        </div>
    </Card>
);
