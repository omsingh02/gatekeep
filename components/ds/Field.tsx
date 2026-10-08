'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from './cn';

interface FieldContextValue {
    id: string;
    describedBy?: string;
    invalid: boolean;
    required?: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Controls inside a Field read their id, aria-describedby and aria-invalid from here. */
export function useField() {
    return useContext(FieldContext);
}

export interface FieldProps {
    label: ReactNode;
    /** Short guidance under the control. Use "Optional" for optional fields (not "(Optional)" in the label). */
    helper?: ReactNode;
    /** Error message; replaces the helper and marks the control invalid */
    error?: ReactNode;
    required?: boolean;
    /** Visually hide the label (it stays available to screen readers) */
    hideLabel?: boolean;
    /** Content to the right of the label (e.g. a "Help me choose" link) */
    labelAction?: ReactNode;
    className?: string;
    id?: string;
    children: ReactNode;
}

/** Label + control + helper/error. Wires the accessible relationships for the child control. */
export function Field({ label, helper, error, required, hideLabel, labelAction, className, id: idProp, children }: FieldProps) {
    const autoId = useId();
    const id = idProp ?? `field-${autoId}`;
    const messageId = `${id}-message`;
    const message = error ?? helper;

    return (
        <FieldContext.Provider value={{ id, describedBy: message ? messageId : undefined, invalid: Boolean(error), required }}>
            <div className={cn('flex flex-col gap-1.5', className)}>
                <div className={cn('flex items-center justify-between gap-2', hideLabel && 'sr-only')}>
                    <label htmlFor={id} className="text-caption font-medium text-secondary">
                        {label}
                    </label>
                    {labelAction}
                </div>
                {children}
                {message && (
                    <p
                        id={messageId}
                        className={cn('text-caption', error ? 'text-danger' : 'text-tertiary')}
                        role={error ? 'alert' : undefined}
                    >
                        {message}
                    </p>
                )}
            </div>
        </FieldContext.Provider>
    );
}
