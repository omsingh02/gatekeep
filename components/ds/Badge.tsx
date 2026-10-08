import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

const tones: Record<BadgeTone, string> = {
    neutral: 'border-default bg-raised text-secondary',
    success: 'border-success-border bg-success-bg text-success',
    warning: 'border-warning-border bg-warning-bg text-warning',
    danger: 'border-danger-border bg-danger-bg text-danger',
};

const dots: Record<BadgeTone, string> = {
    neutral: 'bg-gray-7',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
};

export interface BadgeProps {
    tone?: BadgeTone;
    children: ReactNode;
    className?: string;
}

/** Label for a type or attribute ("Email", "Password", "PDF"). Neutral unless it states a status. */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-caption font-medium',
                tones[tone],
                className
            )}
        >
            {children}
        </span>
    );
}

export interface StatusPillProps {
    tone: BadgeTone;
    children: ReactNode;
    className?: string;
}

/** A status with a leading dot: "Active", "Ends in 2 days", "Ended", "Denied". */
export function StatusPill({ tone, children, className }: StatusPillProps) {
    return (
        <Badge tone={tone} className={className}>
            <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />
            {children}
        </Badge>
    );
}
