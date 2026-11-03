import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './ui.css';

/* The app's buttons (Linear look). primary = the one main action on a screen (accent); secondary =
   everything else (bordered surface); ghost = quiet inline actions; danger = destructive confirm
   (pair with ConfirmDialog). Sizes: sm 28px, md 32px (default), lg 40px for the big mobile
   actions — every size grows to a 40px touch target on coarse pointers (ui-buttons.css).
   ButtonLink is the same look for navigation (a real <a>, so it opens in a new tab, etc.).
   IconButton is a square ghost button for an icon alone, so it MUST carry an aria-label. */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const classes = (base: string, variant: ButtonVariant, size: ButtonSize, extra = '') => `${base} ta-btn--${variant}${size === 'md' ? '' : ` ta-btn--${size}`}${extra ? ` ${extra}` : ''}`;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export const Button = ({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }: ButtonProps) => <button type={type} className={classes('ta-btn', variant, size, className)} {...rest} />;

type LinkProps = { to: string; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string };

export const ButtonLink = ({ to, children, variant = 'secondary', size = 'md', className }: LinkProps) => (
    <Link to={to} className={classes('ta-btn', variant, size, className)}>
        {children}
    </Link>
);

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { 'aria-label': string; variant?: ButtonVariant; size?: 'sm' | 'md' };

/* Square: 28px (sm) / 32px (md) on desktop, 40px on touch. Pass `aria-pressed` for toggles.
   Forwards its ref so a Menu can hand focus back to its trigger. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({ variant = 'ghost', size = 'md', className, type = 'button', title, ...rest }, ref) => (
    <button ref={ref} type={type} title={title ?? rest['aria-label']} className={classes('ta-btn ta-icon-btn', variant, size, className)} {...rest} />
));
IconButton.displayName = 'IconButton';
