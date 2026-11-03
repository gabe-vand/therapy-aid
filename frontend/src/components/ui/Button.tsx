import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './ui.css';

/* The app's buttons. primary = the one main action on a screen; secondary = everything else;
   ghost = quiet inline actions; danger = destructive confirm (pair with ConfirmDialog).
   ButtonLink is the same look for navigation (a real <a>, so it opens in a new tab, etc.). */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const classes = (variant: ButtonVariant, size: 'sm' | 'md', extra = '') => `ta-btn ta-btn--${variant}${size === 'sm' ? ' ta-btn--sm' : ''}${extra ? ` ${extra}` : ''}`;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' };

export const Button = ({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }: ButtonProps) => (
    <button type={type} className={classes(variant, size, className)} {...rest} />
);

type LinkProps = { to: string; children: ReactNode; variant?: ButtonVariant; size?: 'sm' | 'md'; className?: string };

export const ButtonLink = ({ to, children, variant = 'secondary', size = 'md', className }: LinkProps) => (
    <Link to={to} className={classes(variant, size, className)}>
        {children}
    </Link>
);
