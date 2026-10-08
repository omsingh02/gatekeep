'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';
import { Field } from './Field';
import { Input } from './Input';

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openDialogs = 0;

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    /** Buttons, right-aligned: secondary first, primary last */
    footer?: ReactNode;
    size?: 'sm' | 'md';
    /** Element to focus when the dialog opens (defaults to the first focusable element) */
    initialFocus?: RefObject<HTMLElement | null>;
    /** Prevent closing by Escape / backdrop while an action is running */
    busy?: boolean;
}

/**
 * The only modal in the product: portal, role="dialog", aria-modal, focus trap, Escape to close,
 * focus restored to the trigger. Full-height sheet under 640px. Never nest dialogs; edit inline.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'sm', initialFocus, busy }: DialogProps) {
    const titleId = useId();
    const descriptionId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    // Latest callbacks for the document-level key handler, without re-running the open effect
    const onCloseRef = useRef(onClose);
    const busyRef = useRef(busy);
    useEffect(() => {
        onCloseRef.current = onClose;
        busyRef.current = busy;
    });

    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        openDialogs += 1;
        if (openDialogs > 1 && process.env.NODE_ENV !== 'production') {
            console.warn('Gatekeep Mono: dialogs must not be nested. Edit inline instead of opening a second dialog.');
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // First field in the body, then the footer's first button, then the close button
        const focusFirst = () => {
            const panel = panelRef.current;
            const target =
                initialFocus?.current ??
                panel?.querySelector<HTMLElement>(`[data-dialog-body] :is(${FOCUSABLE})`) ??
                panel?.querySelector<HTMLElement>(`[data-dialog-footer] :is(${FOCUSABLE})`) ??
                panel?.querySelector<HTMLElement>(FOCUSABLE) ??
                panel;
            target?.focus();
        };
        const frame = requestAnimationFrame(focusFirst);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busyRef.current) {
                event.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (event.key !== 'Tab' || !panelRef.current) return;
            const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            openDialogs -= 1;
            previouslyFocused?.focus?.();
        };
    }, [open, initialFocus]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <div aria-hidden className="ds-fade-in absolute inset-0 bg-black/60" onClick={() => !busy && onClose()} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={cn(
                    'ds-pop-in relative flex max-h-[100dvh] w-full flex-col border border-default bg-surface shadow-dialog focus:outline-none',
                    'h-[100dvh] sm:h-auto sm:max-h-[min(85vh,800px)] sm:rounded-lg',
                    size === 'sm' ? 'sm:max-w-[480px]' : 'sm:max-w-[640px]'
                )}
            >
                <div className="flex items-start justify-between gap-4 border-b border-subtle px-5 py-4">
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-h2 text-strong">
                            {title}
                        </h2>
                        {description && (
                            <p id={descriptionId} className="mt-1 text-body-sm text-secondary">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close"
                        className="-mr-1.5 -mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-raised hover:text-primary focus-ring disabled:opacity-50"
                    >
                        <X aria-hidden strokeWidth={1.75} className="h-4 w-4" />
                    </button>
                </div>
                {children && (
                    <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-body text-primary">
                        {children}
                    </div>
                )}
                {footer && (
                    <div data-dialog-footer className="flex flex-col-reverse gap-2 border-t border-subtle px-5 py-3 sm:flex-row sm:justify-end">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: ReactNode;
    /** Say what will happen, in plain words: "Maya won't be able to open Q3 pack any more." */
    children: ReactNode;
    /** Verb + object: "Remove access", "Delete file" */
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
}

/** Confirm a consequential action. Destructive confirms use the solid danger button. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel = 'Cancel', destructive }: ConfirmDialogProps) {
    const [busy, setBusy] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirm = async () => {
        setBusy(true);
        try {
            await onConfirm();
        } finally {
            setBusy(false);
        }
    };
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            busy={busy}
            initialFocus={destructive ? cancelRef : undefined}
            footer={
                <>
                    <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
                        {cancelLabel}
                    </Button>
                    <Button variant={destructive ? 'danger-solid' : 'primary'} onClick={confirm} loading={busy}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="text-body text-secondary">{children}</div>
        </Dialog>
    );
}

export interface PromptDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void | Promise<void>;
    title: ReactNode;
    label: string;
    initialValue?: string;
    placeholder?: string;
    submitLabel: string;
    /** Return an error message to block submission */
    validate?: (value: string) => string | null;
}

/** Ask for one value (rename, new folder). Enter submits. */
export function PromptDialog(props: PromptDialogProps) {
    // Remount the form each time it opens so it starts from initialValue
    return props.open ? <PromptDialogForm {...props} /> : null;
}

function PromptDialogForm({ open, onClose, onSubmit, title, label, initialValue = '', placeholder, submitLabel, validate }: PromptDialogProps) {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const formId = useId();

    const submit = async () => {
        const message = validate?.(value) ?? (value.trim() ? null : `Enter a ${label.toLowerCase()}.`);
        if (message) {
            setError(message);
            inputRef.current?.focus();
            return;
        }
        setBusy(true);
        try {
            await onSubmit(value.trim());
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            busy={busy}
            initialFocus={inputRef}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" form={formId} loading={busy}>
                        {submitLabel}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                <Field label={label} error={error}>
                    <Input
                        ref={inputRef}
                        value={value}
                        placeholder={placeholder}
                        onChange={(event) => {
                            setValue(event.target.value);
                            if (error) setError(null);
                        }}
                        onFocus={(event) => event.target.select()}
                    />
                </Field>
            </form>
        </Dialog>
    );
}
