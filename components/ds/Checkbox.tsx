'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: ReactNode;
    description?: ReactNode;
    /** Mixed state, e.g. "some rows selected" in a table header */
    indeterminate?: boolean;
}

/** A real <input type="checkbox">, custom-styled. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
    { label, description, indeterminate = false, className, disabled, ...props },
    ref
) {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
    useEffect(() => {
        if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const box = (
        <span className="relative inline-flex h-4 w-4 shrink-0">
            <input
                ref={inputRef}
                type="checkbox"
                disabled={disabled}
                className="peer absolute inset-0 m-0 h-4 w-4 cursor-pointer appearance-none rounded-sm border border-strong bg-raised transition-colors checked:border-gray-10 checked:bg-gray-10 indeterminate:border-gray-10 indeterminate:bg-gray-10 hover:border-gray-8 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...props}
            />
            <Check
                aria-hidden
                strokeWidth={3}
                className="pointer-events-none absolute inset-0.5 h-3 w-3 text-gray-1 opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
            />
            <Minus
                aria-hidden
                strokeWidth={3}
                className="pointer-events-none absolute inset-0.5 h-3 w-3 text-gray-1 opacity-0 peer-indeterminate:opacity-100"
            />
        </span>
    );

    if (!label) return <span className={className}>{box}</span>;
    return (
        <label className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-60', className)}>
            <span className="mt-0.5">{box}</span>
            <span className="flex flex-col">
                <span className="text-body text-primary">{label}</span>
                {description && <span className="text-caption text-tertiary">{description}</span>}
            </span>
        </label>
    );
});

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: ReactNode;
    description?: ReactNode;
}

/** A real <input type="radio">, custom-styled. Group radios with the same `name`. */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, description, className, disabled, ...props }, ref) {
    return (
        <label className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-60', className)}>
            <span className="relative mt-0.5 inline-flex h-4 w-4 shrink-0">
                <input
                    ref={ref}
                    type="radio"
                    disabled={disabled}
                    className="peer absolute inset-0 m-0 h-4 w-4 cursor-pointer appearance-none rounded-full border border-strong bg-raised transition-colors checked:border-gray-10 hover:border-gray-8 focus-ring disabled:cursor-not-allowed"
                    {...props}
                />
                <span className="pointer-events-none absolute inset-1 rounded-full bg-gray-10 opacity-0 peer-checked:opacity-100" />
            </span>
            <span className="flex flex-col">
                <span className="text-body text-primary">{label}</span>
                {description && <span className="text-caption text-tertiary">{description}</span>}
            </span>
        </label>
    );
});
