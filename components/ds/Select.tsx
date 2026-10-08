'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { useField } from './Field';
import { controlBase, controlState, type ControlSize } from './Input';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    size?: ControlSize;
    invalid?: boolean;
}

/** Styled native select: keyboard, screen reader and mobile behaviour come for free. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { size = 'md', invalid, className, id, children, ...props },
    ref
) {
    const field = useField();
    const isInvalid = invalid ?? field?.invalid;
    return (
        <div className="relative">
            <select
                ref={ref}
                id={id ?? field?.id}
                aria-invalid={isInvalid || undefined}
                aria-describedby={field?.describedBy}
                className={cn(
                    controlBase,
                    controlState(isInvalid),
                    'appearance-none pr-8 [color-scheme:dark]',
                    size === 'lg' ? 'h-10 pl-3 text-body' : 'h-8 pl-2.5 text-body',
                    className
                )}
                {...props}
            >
                {children}
            </select>
            <ChevronDown
                aria-hidden
                strokeWidth={1.75}
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary"
            />
        </div>
    );
});
