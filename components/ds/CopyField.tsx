'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from './cn';

export interface CopyFieldProps {
    value: string;
    /** Accessible name, e.g. "Delivery link" */
    label: string;
    /** Show the value as a multi-line block (invites) instead of a single line (links, passwords) */
    multiline?: boolean;
    /** Mask the value until revealed (passwords) */
    masked?: boolean;
    className?: string;
}

/** A read-only value with a copy button that confirms "Copied" (also announced to screen readers). */
export function CopyField({ value, label, multiline, masked, className }: CopyFieldProps) {
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), 1800);
        return () => clearTimeout(timer);
    }, [copied]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setFailed(false);
            setCopied(true);
        } catch {
            setFailed(true);
        }
    };

    const shown = masked && !copied ? '•'.repeat(Math.min(value.length, 16)) : value;

    return (
        <div className={cn('flex w-full items-stretch overflow-hidden rounded-md border border-default bg-inset', className)}>
            <div
                aria-label={label}
                className={cn(
                    'min-w-0 flex-1 px-2.5 py-1.5 font-mono text-body-sm text-primary',
                    multiline ? 'whitespace-pre-wrap break-words' : 'truncate leading-5'
                )}
            >
                {shown}
            </div>
            <button
                type="button"
                onClick={copy}
                className={cn(
                    'flex shrink-0 items-center gap-1.5 border-l border-default px-2.5 text-body-sm font-medium transition-colors focus-ring',
                    copied ? 'text-success' : 'text-secondary hover:bg-raised hover:text-primary',
                    multiline && 'items-start pt-1.5'
                )}
            >
                {copied ? <Check aria-hidden strokeWidth={2} className="h-3.5 w-3.5" /> : <Copy aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
                <span className="sr-only" aria-live="polite">
                    {copied ? `${label} copied` : failed ? `Couldn't copy ${label}. Select the text and copy it.` : ''}
                </span>
            </button>
        </div>
    );
}
