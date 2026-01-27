'use client';

import React from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
    isLoading?: boolean;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    isLoading = false,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            confirmBg: '#dc2626',
            confirmHoverBg: '#b91c1c',
            iconBg: '#7f1d1d',
            iconColor: '#fca5a5',
        },
        warning: {
            confirmBg: '#d97706',
            confirmHoverBg: '#b45309',
            iconBg: '#78350f',
            iconColor: '#fcd34d',
        },
        default: {
            confirmBg: '#3b82f6',
            confirmHoverBg: '#2563eb',
            iconBg: '#1e3a8a',
            iconColor: '#93c5fd',
        },
    };

    const styles = variantStyles[variant];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && !isLoading) {
            onClose();
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
            }}
            onKeyDown={handleKeyDown}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: -1,
                }}
                onClick={isLoading ? undefined : onClose}
            />

            {/* Dialog */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '400px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '8px',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    animation: 'fadeInScale 0.15s ease-out',
                }}
            >
                <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                        {/* Icon */}
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: styles.iconBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            {variant === 'danger' ? (
                                <svg style={{ width: '20px', height: '20px', color: styles.iconColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            ) : variant === 'warning' ? (
                                <svg style={{ width: '20px', height: '20px', color: styles.iconColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg style={{ width: '20px', height: '20px', color: styles.iconColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                            <h3
                                style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: '#e0e0e0',
                                    margin: 0,
                                    marginBottom: '0.5rem',
                                }}
                            >
                                {title}
                            </h3>
                            <p
                                style={{
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    margin: 0,
                                    lineHeight: 1.5,
                                }}
                            >
                                {message}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '0.75rem',
                            marginTop: '1.5rem',
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#e0e0e0',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '6px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.5 : 1,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }}
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'white',
                                backgroundColor: styles.confirmBg,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.7 : 1,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = styles.confirmHoverBg;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = styles.confirmBg;
                                }
                            }}
                        >
                            {isLoading && (
                                <svg
                                    style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            )}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeInScale {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
}
