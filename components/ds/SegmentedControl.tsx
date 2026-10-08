'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
    icon?: ReactNode;
    disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
    /** NoInfer: T is inferred from `value` only, so string-literal state types (and setState) work */
    options: SegmentedOption<NoInfer<T>>[];
    value: T;
    onChange: (value: NoInfer<T>) => void;
    /** Accessible name for the group */
    label: string;
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    className?: string;
}

/** A neutral single-choice switcher (radiogroup semantics, arrow keys move the selection). Never coloured per option. */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    label,
    size = 'md',
    fullWidth,
    className,
}: SegmentedControlProps<T>) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const enabled = options.filter((o) => !o.disabled);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const current = enabled.findIndex((o) => o.value === value);
        const next = enabled[(current + delta + enabled.length) % enabled.length];
        onChange(next.value);
        refs.current[options.indexOf(next)]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                'inline-flex gap-0.5 rounded-md border border-default bg-inset p-0.5',
                // Hug the options even inside stretching flex columns (e.g. a Field)
                fullWidth ? 'flex w-full' : 'w-fit max-w-full self-start',
                className
            )}
        >
            {options.map((option, i) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        disabled={option.disabled}
                        onClick={() => onChange(option.value)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            'inline-flex items-center justify-center gap-1.5 rounded-[5px] border font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40',
                            size === 'sm' ? 'h-6 px-2 text-caption' : 'h-7 px-3 text-body-sm',
                            fullWidth && 'flex-1',
                            selected ? 'border-default bg-raised text-strong' : 'border-transparent text-secondary hover:text-primary'
                        )}
                    >
                        {option.icon}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
