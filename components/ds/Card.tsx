import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    /** Remove the default 20px padding (for tables and lists that run edge to edge) */
    flush?: boolean;
}

/** Flat surface with a 1px border. No shadow: only floating layers have elevation. */
export function Card({ flush, className, ...props }: CardProps) {
    return <div className={cn('rounded-lg border border-default bg-surface', !flush && 'p-4 sm:p-5', className)} {...props} />;
}

/** Alias: a Panel is a Card that groups a section of a page. */
export const Panel = Card;

export interface CardHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}

/** Title row for a flush card: title + description on the left, actions on the right, divider below. */
export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-5', className)}>
            <div className="min-w-0">
                <h3 className="text-h3 text-strong">{title}</h3>
                {description && <p className="mt-0.5 text-body-sm text-secondary">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />;
}

export interface StatCardProps {
    label: ReactNode;
    value: ReactNode;
    /** Secondary line under the value, e.g. "3 this week" */
    detail?: ReactNode;
    /** Optional status dot next to the label */
    status?: 'success' | 'warning' | 'danger';
    className?: string;
}

const dot: Record<NonNullable<StatCardProps['status']>, string> = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
};

/** One number with its label. No icon tiles, no coloured numbers. */
export function StatCard({ label, value, detail, status, className }: StatCardProps) {
    return (
        <Card className={cn('flex flex-col gap-1', className)}>
            <span className="flex items-center gap-1.5 text-caption font-medium text-secondary">
                {status && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dot[status])} />}
                {label}
            </span>
            <span className="text-[24px] font-semibold leading-8 tabular-nums text-strong">{value}</span>
            {detail && <span className="text-caption text-tertiary">{detail}</span>}
        </Card>
    );
}
