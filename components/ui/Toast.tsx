'use client';

import React, { useState, createContext, useContext, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const toast: Toast = { id, message, type, duration };
        
        setToasts((prev) => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const success = useCallback((message: string, duration?: number) => {
        showToast(message, 'success', duration);
    }, [showToast]);

    const error = useCallback((message: string, duration?: number) => {
        showToast(message, 'error', duration ?? 6000);
    }, [showToast]);

    const info = useCallback((message: string, duration?: number) => {
        showToast(message, 'info', duration);
    }, [showToast]);

    const warning = useCallback((message: string, duration?: number) => {
        showToast(message, 'warning', duration ?? 5000);
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '1.5rem',
                right: '1.5rem',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxWidth: '400px',
                width: '100%',
                pointerEvents: 'none',
            }}
        >
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    const [isExiting, setIsExiting] = useState(false);

    const typeStyles = {
        success: {
            bg: '#14532d',
            border: '#22c55e',
            icon: '#86efac',
        },
        error: {
            bg: '#7f1d1d',
            border: '#ef4444',
            icon: '#fca5a5',
        },
        warning: {
            bg: '#78350f',
            border: '#f59e0b',
            icon: '#fcd34d',
        },
        info: {
            bg: '#312e81',
            border: '#6366f1',
            icon: '#a5b4fc',
        },
    };

    const styles = typeStyles[toast.type];

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => {
            onDismiss(toast.id);
        }, 150);
    };

    const icons = {
        success: (
            <svg style={{ width: '20px', height: '20px', color: styles.icon }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: (
            <svg style={{ width: '20px', height: '20px', color: styles.icon }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
        warning: (
            <svg style={{ width: '20px', height: '20px', color: styles.icon }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        info: (
            <svg style={{ width: '20px', height: '20px', color: styles.icon }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: styles.bg,
                border: `1px solid ${styles.border}`,
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                pointerEvents: 'auto',
                animation: isExiting ? 'fadeOutSlide 0.15s ease-in forwards' : 'fadeInSlide 0.2s ease-out',
            }}
        >
            <div style={{ flexShrink: 0 }}>{icons[toast.type]}</div>
            
            <p
                style={{
                    flex: 1,
                    margin: 0,
                    fontSize: '0.875rem',
                    color: '#e0e0e0',
                    lineHeight: 1.5,
                }}
            >
                {toast.message}
            </p>

            <button
                onClick={handleDismiss}
                style={{
                    flexShrink: 0,
                    padding: '0.25rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                }}
            >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <style>{`
                @keyframes fadeInSlide {
                    from {
                        opacity: 0;
                        transform: translateX(1rem);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes fadeOutSlide {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(1rem);
                    }
                }
            `}</style>
        </div>
    );
}
