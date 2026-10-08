import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { cn } from './cn';

export interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    /** Right-aligned actions (primary action last) */
    actions?: ReactNode;
    /** Breadcrumb above the title */
    breadcrumb?: ReactNode;
    className?: string;
}

export function PageHeader({ title, description, actions, breadcrumb, className }: PageHeaderProps) {
    return (
        <header className={cn('flex flex-col gap-3', className)}>
            {breadcrumb}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-h1 text-strong">{title}</h1>
                    {description && <p className="mt-1 text-body text-secondary">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </header>
    );
}

export interface Crumb {
    label: ReactNode;
    /** Omit for the current page */
    href?: string;
    onClick?: () => void;
}

/** Text links separated by "/", the last item is the current location (not a button). */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
    return (
        <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
            <ol className="flex flex-wrap items-center gap-1.5 text-body-sm">
                {items.map((item, i) => {
                    const last = i === items.length - 1;
                    return (
                        <Fragment key={i}>
                            <li className="min-w-0">
                                {last ? (
                                    <span aria-current="page" className="block truncate font-medium text-strong">
                                        {item.label}
                                    </span>
                                ) : item.href ? (
                                    <Link href={item.href} className="block truncate rounded-sm text-secondary hover:text-primary focus-ring">
                                        {item.label}
                                    </Link>
                                ) : (
                                    <button type="button" onClick={item.onClick} className="block truncate rounded-sm text-secondary hover:text-primary focus-ring">
                                        {item.label}
                                    </button>
                                )}
                            </li>
                            {!last && (
                                <li aria-hidden className="text-tertiary">
                                    /
                                </li>
                            )}
                        </Fragment>
                    );
                })}
            </ol>
        </nav>
    );
}

/** Search + filters + view toggle above a table. Wraps on small screens. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
    const initial = (name.trim()[0] ?? '?').toUpperCase();
    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full bg-gray-4 font-medium text-primary',
                size === 'sm' ? 'h-6 w-6 text-caption' : 'h-8 w-8 text-body-sm',
                className
            )}
        >
            {initial}
        </span>
    );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-default bg-raised px-1 font-mono text-caption text-secondary', className)}>
            {children}
        </kbd>
    );
}

/**
 * Small text tooltip on hover and keyboard focus. Wrap the trigger; the trigger keeps its own
 * accessible name (the tooltip is supplementary, via aria-describedby on the wrapper).
 */
export function Tooltip({ content, children, side = 'top', className }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom'; className?: string }) {
    return (
        <span className={cn('group/tooltip relative inline-flex', className)}>
            {children}
            <span
                role="tooltip"
                className={cn(
                    'pointer-events-none absolute left-1/2 z-50 w-max max-w-60 -translate-x-1/2 rounded-md border border-default bg-raised px-2 py-1 text-caption text-primary opacity-0 shadow-overlay transition-opacity duration-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
                    side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                )}
            >
                {content}
            </span>
        </span>
    );
}
