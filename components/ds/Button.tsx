import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-100 focus-ring disabled:pointer-events-none disabled:opacity-50 select-none';

const variants: Record<ButtonVariant, string> = {
    primary: 'bg-gray-10 text-gray-1 hover:bg-white active:bg-gray-9',
    secondary: 'border border-default bg-raised text-primary hover:border-strong hover:bg-gray-4 active:bg-gray-3',
    ghost: 'text-secondary hover:bg-raised hover:text-primary active:bg-gray-4',
    danger: 'text-danger hover:bg-danger-bg active:bg-danger-bg',
    'danger-solid': 'bg-danger-solid text-white hover:bg-danger-solid-hover',
    link: 'h-auto px-0 text-primary underline-offset-4 hover:text-strong hover:underline',
};

const sizes: Record<ButtonSize, string> = {
    sm: 'h-7 px-2.5 text-body-sm',
    md: 'h-8 px-3 text-body',
    lg: 'h-10 px-4 text-body',
};

const iconSizes: Record<ButtonSize, string> = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows the spinner, keeps the width and disables the button */
    loading?: boolean;
    /** Icon before the label (16px lucide icon) */
    icon?: ReactNode;
    /** Icon after the label */
    iconRight?: ReactNode;
    fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'secondary', size = 'md', loading = false, icon, iconRight, fullWidth, className, children, disabled, type = 'button', ...props },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(base, variants[variant], variant !== 'link' && sizes[size], fullWidth && 'w-full', className)}
            {...props}
        >
            {loading ? <Spinner label="Working" /> : icon}
            {children}
            {!loading && iconRight}
        </button>
    );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    /** Required: icon-only buttons need an accessible name (also shown as the tooltip) */
    label: string;
    icon: ReactNode;
    variant?: Exclude<ButtonVariant, 'link'>;
    size?: ButtonSize;
}

/** Square, icon-only button. The label is the accessible name and the native tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { label, icon, variant = 'ghost', size = 'md', className, type = 'button', ...props },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={label}
            className={cn(base, variants[variant], iconSizes[size], className)}
            {...props}
        >
            {icon}
        </button>
    );
});
