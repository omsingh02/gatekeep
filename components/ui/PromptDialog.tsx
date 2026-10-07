'use client';

import React, { useState, useEffect, useRef } from 'react';

interface PromptDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    submitText?: string;
    cancelText?: string;
    isLoading?: boolean;
    inputType?: 'text' | 'email' | 'number';
    validation?: (value: string) => string | null; // Returns error message or null
}

export function PromptDialog({
    isOpen,
    onClose,
    onSubmit,
    title,
    message,
    placeholder = '',
    defaultValue = '',
    submitText = 'Submit',
    cancelText = 'Cancel',
    isLoading = false,
    inputType = 'text',
    validation,
}: PromptDialogProps) {
    const [value, setValue] = useState(defaultValue);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset the field whenever the dialog opens (or its default changes while open).
    // Adjusting state during render avoids an extra effect-driven render pass.
    const [prevOpen, setPrevOpen] = useState(isOpen);
    const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
    if (isOpen !== prevOpen || defaultValue !== prevDefaultValue) {
        setPrevOpen(isOpen);
        setPrevDefaultValue(defaultValue);
        if (isOpen) {
            setValue(defaultValue);
            setError(null);
        }
    }

    useEffect(() => {
        if (isOpen) {
            // Focus input after a short delay to ensure the dialog is rendered
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            setError('This field is required');
            return;
        }

        if (validation) {
            const validationError = validation(trimmedValue);
            if (validationError) {
                setError(validationError);
                return;
            }
        }

        setError(null);
        onSubmit(trimmedValue);
    };

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
            <form
                onSubmit={handleSubmit}
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
                    {/* Header */}
                    <h3
                        style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#e0e0e0',
                            margin: 0,
                            marginBottom: message ? '0.5rem' : '1rem',
                        }}
                    >
                        {title}
                    </h3>
                    
                    {message && (
                        <p
                            style={{
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                margin: 0,
                                marginBottom: '1rem',
                                lineHeight: 1.5,
                            }}
                        >
                            {message}
                        </p>
                    )}

                    {/* Input */}
                    <div>
                        <input
                            ref={inputRef}
                            type={inputType}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                setError(null);
                            }}
                            placeholder={placeholder}
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                fontSize: '0.9rem',
                                color: '#e0e0e0',
                                backgroundColor: '#1a1a1a',
                                border: `1px solid ${error ? '#ef4444' : '#3a3a3a'}`,
                                borderRadius: '6px',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => {
                                if (!error) e.currentTarget.style.borderColor = '#6366f1';
                            }}
                            onBlur={(e) => {
                                if (!error) e.currentTarget.style.borderColor = '#3a3a3a';
                            }}
                        />
                        {error && (
                            <p
                                style={{
                                    fontSize: '0.8rem',
                                    color: '#ef4444',
                                    margin: 0,
                                    marginTop: '0.5rem',
                                }}
                            >
                                {error}
                            </p>
                        )}
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
                            type="submit"
                            disabled={isLoading}
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'white',
                                backgroundColor: '#6366f1',
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
                                    e.currentTarget.style.backgroundColor = '#4f46e5';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = '#6366f1';
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
                            {submitText}
                        </button>
                    </div>
                </div>
            </form>

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
