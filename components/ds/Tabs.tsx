'use client';

import Link from 'next/link';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

const tabClass = (active: boolean) =>
    cn(
        '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-body font-medium transition-colors focus-ring',
        active ? 'border-gray-10 text-strong' : 'border-transparent text-secondary hover:border-strong hover:text-primary'
    );

export interface TabItem<T extends string> {
    value: T;
    label: ReactNode;
    icon?: ReactNode;
    /** Small count after the label */
    count?: number;
}

export interface TabsProps<T extends string> {
    /** NoInfer: T is inferred from `value` only, so string-literal state types (and setState) work */
    items: TabItem<NoInfer<T>>[];
    value: T;
    onChange: (value: NoInfer<T>) => void;
    label: string;
    className?: string;
}

/** In-page tabs (tablist semantics, arrow keys). Pair each panel with id `${value}-panel`. */
export function Tabs<T extends string>({ items, value, onChange, label, className }: TabsProps<T>) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const onKeyDown = (event: KeyboardEvent) => {
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const i = items.findIndex((item) => item.value === value);
        const next = (i + delta + items.length) % items.length;
        onChange(items[next].value);
        refs.current[next]?.focus();
    };
    return (
        <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-subtle', className)}>
            {items.map((item, i) => {
                const active = item.value === value;
                return (
                    <button
                        key={item.value}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`${item.value}-tab`}
                        aria-selected={active}
                        aria-controls={`${item.value}-panel`}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(item.value)}
                        onKeyDown={onKeyDown}
                        className={tabClass(active)}
                    >
                        {item.icon}
                        {item.label}
                        {item.count !== undefined && (
                            <span className="rounded-sm bg-raised px-1.5 text-caption tabular-nums text-secondary">{item.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export interface NavTab {
    href: string;
    label: ReactNode;
    icon?: ReactNode;
    active: boolean;
}

/** Section navigation that looks like tabs but navigates (links with aria-current). */
export function TabNav({ items, label, className }: { items: NavTab[]; label: string; className?: string }) {
    return (
        <nav aria-label={label} className={cn('flex gap-1 overflow-x-auto', className)}>
            {items.map((item) => (
                <Link key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined} className={tabClass(item.active)}>
                    {item.icon}
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
