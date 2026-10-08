import type { ReactNode } from 'react';
import { AlertTriangle, CircleAlert, Info, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface EmptyStateProps {
    icon: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    /** One primary or secondary action */
    action?: ReactNode;
    className?: string;
}

/** What to show when a list has nothing in it yet: one icon, one sentence, one action. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-default bg-raised text-secondary">
                <Icon aria-hidden strokeWidth={1.75} className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-h3 text-strong">{title}</h3>
            {description && <p className="mt-1 max-w-sm text-body-sm text-secondary">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

/** Loading placeholder that matches the final layout's dimensions. */
export function Skeleton({ className }: { className?: string }) {
    return <span aria-hidden className={cn('ds-shimmer block rounded-md bg-raised', className)} />;
}

export type CalloutTone = 'neutral' | 'warning' | 'danger' | 'success';

const calloutTones: Record<CalloutTone, { box: string; icon: LucideIcon; iconClass: string }> = {
    neutral: { box: 'border-default bg-raised', icon: Info, iconClass: 'text-secondary' },
    success: { box: 'border-success-border bg-success-bg', icon: Info, iconClass: 'text-success' },
    warning: { box: 'border-warning-border bg-warning-bg', icon: AlertTriangle, iconClass: 'text-warning' },
    danger: { box: 'border-danger-border bg-danger-bg', icon: CircleAlert, iconClass: 'text-danger' },
};

export interface CalloutProps {
    tone?: CalloutTone;
    title?: ReactNode;
    children?: ReactNode;
    /** Inline action at the end (a link-style button) */
    action?: ReactNode;
    className?: string;
}

/** An inline message inside a page or dialog: icon + text on a tinted background. */
export function Callout({ tone = 'neutral', title, children, action, className }: CalloutProps) {
    const { box, icon: Icon, iconClass } = calloutTones[tone];
    return (
        <div
            role={tone === 'danger' ? 'alert' : 'note'}
            className={cn('flex gap-2.5 rounded-md border px-3 py-2.5 text-body-sm', box, className)}
        >
            <Icon aria-hidden strokeWidth={1.75} className={cn('mt-px h-4 w-4 shrink-0', iconClass)} />
            <div className="min-w-0 flex-1">
                {title && <p className="font-medium text-strong">{title}</p>}
                {children && <div className={cn('text-primary', title && 'mt-0.5 text-secondary')}>{children}</div>}
            </div>
            {action && <div className="shrink-0 self-center">{action}</div>}
        </div>
    );
}
