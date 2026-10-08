'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, Info, X, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
    /** Optional single action, e.g. { label: 'Undo', onClick } */
    action?: { label: string; onClick: () => void };
    /** ms before auto-dismiss; 0 keeps it until dismissed. Defaults: 4000 (6000 for danger). */
    duration?: number;
}

interface ToastItem extends ToastOptions {
    id: number;
    tone: ToastTone;
    message: ReactNode;
}

interface ToastApi {
    show: (message: ReactNode, tone?: ToastTone, options?: ToastOptions) => void;
    success: (message: ReactNode, options?: ToastOptions) => void;
    warning: (message: ReactNode, options?: ToastOptions) => void;
    error: (message: ReactNode, options?: ToastOptions) => void;
    info: (message: ReactNode, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const MAX_TOASTS = 3;

const icons: Record<ToastTone, { icon: LucideIcon; className: string }> = {
    neutral: { icon: Info, className: 'text-secondary' },
    success: { icon: CheckCircle2, className: 'text-success' },
    warning: { icon: AlertTriangle, className: 'text-warning' },
    danger: { icon: CircleAlert, className: 'text-danger' },
};

/** Mount once near the root. Errors are announced assertively, everything else politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

    const show = useCallback((message: ReactNode, tone: ToastTone = 'neutral', options: ToastOptions = {}) => {
        const id = nextId.current++;
        setToasts((list) => [...list, { id, tone, message, ...options }].slice(-MAX_TOASTS));
    }, []);

    const api = useMemo<ToastApi>(
        () => ({
            show,
            success: (m, o) => show(m, 'success', o),
            warning: (m, o) => show(m, 'warning', o),
            error: (m, o) => show(m, 'danger', o),
            info: (m, o) => show(m, 'neutral', o),
        }),
        [show]
    );

    const polite = toasts.filter((t) => t.tone !== 'danger');
    const assertive = toasts.filter((t) => t.tone === 'danger');

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
                <div aria-live="polite" role="status" className="flex flex-col gap-2">
                    {polite.map((t) => (
                        <ToastView key={t.id} toast={t} onDismiss={dismiss} />
                    ))}
                </div>
                <div aria-live="assertive" role="alert" className="flex flex-col gap-2">
                    {assertive.map((t) => (
                        <ToastView key={t.id} toast={t} onDismiss={dismiss} />
                    ))}
                </div>
            </div>
        </ToastContext.Provider>
    );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
    const { icon: Icon, className } = icons[toast.tone];
    const duration = toast.duration ?? (toast.tone === 'danger' ? 6000 : 4000);
    useEffect(() => {
        if (!duration) return;
        const timer = setTimeout(() => onDismiss(toast.id), duration);
        return () => clearTimeout(timer);
    }, [duration, onDismiss, toast.id]);

    return (
        <div className="ds-pop-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-default bg-raised px-3 py-2.5 shadow-overlay">
            <Icon aria-hidden strokeWidth={1.75} className={cn('mt-0.5 h-4 w-4 shrink-0', className)} />
            <div className="min-w-0 flex-1 text-body text-primary">{toast.message}</div>
            {toast.action && (
                <button
                    type="button"
                    onClick={() => {
                        toast.action?.onClick();
                        onDismiss(toast.id);
                    }}
                    className="shrink-0 rounded-sm text-body font-medium text-strong underline-offset-4 hover:underline focus-ring"
                >
                    {toast.action.label}
                </button>
            )}
            <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss"
                className="-mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-tertiary hover:text-primary focus-ring"
            >
                <X aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export function useToast(): ToastApi {
    const api = useContext(ToastContext);
    if (!api) throw new Error('useToast must be used inside <ToastProvider>');
    return api;
}
