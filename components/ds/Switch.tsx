'use client';

import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    className?: string;
}

/** On/off setting that applies immediately (use a Checkbox inside forms that need submitting). */
export function Switch({ checked, onCheckedChange, label, description, disabled, className }: SwitchProps) {
    const id = useId();
    return (
        <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60', className)}>
            <span className="flex flex-col">
                <label htmlFor={id} className="cursor-pointer text-body text-primary">
                    {label}
                </label>
                {description && <span className="text-caption text-tertiary">{description}</span>}
            </span>
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onCheckedChange(!checked)}
                className={cn(
                    'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-ring disabled:cursor-not-allowed',
                    checked ? 'border-gray-10 bg-gray-10' : 'border-strong bg-raised hover:border-gray-8'
                )}
            >
                <span
                    aria-hidden
                    className={cn(
                        'inline-block h-3.5 w-3.5 rounded-full transition-transform duration-150',
                        checked ? 'translate-x-[18px] bg-gray-1' : 'translate-x-[2px] bg-gray-8'
                    )}
                />
            </button>
        </div>
    );
}
