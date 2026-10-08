'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { useField } from './Field';

export type ControlSize = 'md' | 'lg';

export const controlBase =
    'w-full rounded-md border bg-raised text-primary placeholder:text-tertiary transition-colors duration-100 ' +
    'hover:border-strong focus:outline-none focus-visible:outline-none focus:border-gray-8 focus:ring-2 focus:ring-white/15 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

/** Read-only text fields sit in an inset well. Not on selects: CSS treats every <select> as :read-only. */
const readOnlyInset = 'read-only:bg-inset';

export function controlState(invalid?: boolean) {
    return invalid ? 'border-danger-border focus:border-danger focus:ring-danger-bg' : 'border-default';
}

const heights: Record<ControlSize, string> = {
    md: 'h-8 px-2.5 text-body',
    lg: 'h-10 px-3 text-body',
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    size?: ControlSize;
    invalid?: boolean;
    /** Icon or text inside the left edge (e.g. a search icon) */
    leading?: ReactNode;
    /** Element inside the right edge (e.g. a show-password button) */
    trailing?: ReactNode;
    mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { size = 'md', invalid, leading, trailing, mono, className, id, ...props },
    ref
) {
    const field = useField();
    const isInvalid = invalid ?? field?.invalid;
    const input = (
        <input
            ref={ref}
            id={id ?? field?.id}
            aria-invalid={isInvalid || undefined}
            aria-describedby={field?.describedBy}
            aria-required={field?.required || undefined}
            className={cn(
                controlBase,
                readOnlyInset,
                controlState(isInvalid),
                heights[size],
                mono && 'font-mono',
                leading ? 'pl-8' : undefined,
                trailing ? 'pr-9' : undefined,
                className
            )}
            {...props}
        />
    );
    if (!leading && !trailing) return input;
    return (
        <div className="relative">
            {leading && (
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-tertiary">{leading}</span>
            )}
            {input}
            {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
        </div>
    );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean;
    mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { invalid, mono, className, id, rows = 3, ...props },
    ref
) {
    const field = useField();
    const isInvalid = invalid ?? field?.invalid;
    return (
        <textarea
            ref={ref}
            id={id ?? field?.id}
            rows={rows}
            aria-invalid={isInvalid || undefined}
            aria-describedby={field?.describedBy}
            className={cn(controlBase, readOnlyInset, controlState(isInvalid), 'min-h-16 px-2.5 py-2 text-body leading-5', mono && 'font-mono', className)}
            {...props}
        />
    );
});
