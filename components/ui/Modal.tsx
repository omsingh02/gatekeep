'use client';

import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeStyles = {
        sm: 'min(448px, calc(100vw - 2rem))',
        md: 'min(512px, calc(100vw - 2rem))',
        lg: 'min(672px, calc(100vw - 2rem))',
        xl: 'min(896px, calc(100vw - 2rem))',
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
        }}>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: -1,
                }}
                onClick={onClose}
            />

            {/* Modal */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: sizeStyles[size],
                backgroundColor: '#12141c',
                borderRadius: '8px',
                border: '1px solid #23263a',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}>
                {title && (
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid #23263a',
                    }}>
                        <h2 style={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            color: '#e0e0e0',
                            margin: 0,
                        }}>{title}</h2>
                    </div>
                )}

                <div style={{
                    padding: 'clamp(1rem, 3vw, 1.5rem)',
                    maxHeight: 'calc(100vh - 200px)',
                    overflowY: 'auto',
                }}>
                    {children}
                </div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0b0c11';
                        e.currentTarget.style.color = '#e0e0e0';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9ca3af';
                    }}
                    aria-label="Close modal"
                >
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
