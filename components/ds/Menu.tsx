'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from './cn';

export type MenuItem =
    | { type?: 'item'; label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; shortcut?: ReactNode }
    | { type: 'separator' };

export interface MenuProps {
    items: MenuItem[];
    /** Accessible name of the trigger, e.g. "More actions for Q3 deck.pdf" */
    label: string;
    /** Custom trigger content; defaults to a "…" icon button */
    trigger?: ReactNode;
    align?: 'start' | 'end';
    /** Non-interactive context above the items, e.g. the signed-in account's email */
    header?: ReactNode;
    className?: string;
}

/** Dropdown of actions. Arrow keys move, Enter selects, Escape closes and returns focus. */
export function Menu({ items, label, trigger, align = 'end', header, className }: MenuProps) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const menuId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const actionable = items.map((item, i) => ({ item, i })).filter(({ item }) => item.type !== 'separator' && !item.disabled);

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: MouseEvent) => {
            if (!listRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        return () => document.removeEventListener('mousedown', onPointer);
    }, [open]);

    useEffect(() => {
        if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${actionable[active]?.i}"]`)?.focus();
    }, [open, active, actionable]);

    const close = (refocus = true) => {
        setOpen(false);
        if (refocus) triggerRef.current?.focus();
    };

    const onTriggerKey = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setActive(0);
            setOpen(true);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(actionable.length - 1);
            setOpen(true);
        }
    };

    const onListKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((a) => (a + 1) % actionable.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((a) => (a - 1 + actionable.length) % actionable.length);
        } else if (event.key === 'Home') {
            event.preventDefault();
            setActive(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            setActive(actionable.length - 1);
        } else if (event.key === 'Tab') {
            close(false);
        }
    };

    return (
        <div className={cn('relative inline-flex', className)}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={trigger ? undefined : label}
                title={trigger ? undefined : label}
                onClick={() => {
                    setActive(0);
                    setOpen((o) => !o);
                }}
                onKeyDown={onTriggerKey}
                className={cn(
                    'inline-flex items-center justify-center rounded-md text-secondary transition-colors hover:bg-raised hover:text-primary focus-ring',
                    trigger ? 'h-8 gap-2 px-3 text-body' : 'h-8 w-8',
                    open && 'bg-raised text-primary'
                )}
            >
                {trigger ?? <MoreHorizontal aria-hidden strokeWidth={1.75} className="h-4 w-4" />}
            </button>
            {open && (
                <div
                    ref={listRef}
                    id={menuId}
                    role="menu"
                    aria-label={label}
                    onKeyDown={onListKey}
                    className={cn(
                        'ds-pop-in absolute top-full z-40 mt-1 min-w-44 rounded-lg border border-default bg-raised p-1 shadow-overlay',
                        align === 'end' ? 'right-0' : 'left-0'
                    )}
                >
                    {header && (
                        <>
                            <div className="px-2 pb-1.5 pt-1 text-body-sm text-secondary">{header}</div>
                            <div role="separator" className="my-1 h-px bg-gray-4" />
                        </>
                    )}
                    {items.map((item, i) =>
                        item.type === 'separator' ? (
                            <div key={i} role="separator" className="my-1 h-px bg-gray-4" />
                        ) : (
                            <button
                                key={i}
                                type="button"
                                role="menuitem"
                                data-index={i}
                                tabIndex={-1}
                                disabled={item.disabled}
                                onClick={() => {
                                    close();
                                    item.onSelect();
                                }}
                                onMouseEnter={() => setActive(actionable.findIndex((a) => a.i === i))}
                                className={cn(
                                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-body focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                                    item.danger ? 'text-danger focus:bg-danger-bg' : 'text-primary focus:bg-gray-4'
                                )}
                            >
                                {item.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center opacity-80">{item.icon}</span>}
                                <span className="flex-1 truncate">{item.label}</span>
                                {item.shortcut && <span className="text-caption text-tertiary">{item.shortcut}</span>}
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
