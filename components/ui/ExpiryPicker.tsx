'use client';

import { useState, useEffect } from 'react';

interface ExpiryPickerProps {
    value: string; // ISO date string or datetime-local format
    onChange: (value: string) => void;
    label?: string;
    showLabel?: boolean;
    helperText?: string;
}

type PresetKey = '1h' | '24h' | '7d' | '30d' | '90d' | 'custom' | 'never';

interface Preset {
    label: string;
    getDate: () => Date | null;
}

const presets: Record<PresetKey, Preset> = {
    '1h': { label: '1 Hour', getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
    '24h': { label: '24 Hours', getDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
    '7d': { label: '7 Days', getDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    '30d': { label: '30 Days', getDate: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    '90d': { label: '90 Days', getDate: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    'custom': { label: 'Custom', getDate: () => null },
    'never': { label: 'Never', getDate: () => null },
};

function toLocalDateTimeValue(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    // Format to YYYY-MM-DDTHH:mm for datetime-local input
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatPreviewDate(value: string): string {
    if (!value) return 'No expiry (permanent)';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    
    if (diff < 0) {
        return `Expired ${formatRelative(-diff)} ago`;
    }
    
    return `Expires in ${formatRelative(diff)} (${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
}

function formatRelative(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return days === 1 ? '1 day' : `${days} days`;
    }
    if (hours > 0) {
        return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    if (minutes > 0) {
        return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    }
    return 'less than a minute';
}

export default function ExpiryPicker({ 
    value, 
    onChange, 
    label = 'Expiry Date/Time',
    showLabel = true,
    helperText = 'Leave empty for permanent access',
}: ExpiryPickerProps) {
    const [selectedPreset, setSelectedPreset] = useState<PresetKey>('never');
    const [showCustom, setShowCustom] = useState(false);

    // Initialize preset based on value
    useEffect(() => {
        if (!value) {
            setSelectedPreset('never');
            setShowCustom(false);
        } else {
            // Check if value matches any preset (within 1 minute tolerance)
            const targetDate = new Date(value).getTime();
            const now = Date.now();
            const diff = targetDate - now;
            
            // Check preset matches (with 2 minute tolerance for timing)
            const tolerance = 2 * 60 * 1000;
            
            if (Math.abs(diff - 60 * 60 * 1000) < tolerance) {
                setSelectedPreset('1h');
                setShowCustom(false);
            } else if (Math.abs(diff - 24 * 60 * 60 * 1000) < tolerance) {
                setSelectedPreset('24h');
                setShowCustom(false);
            } else if (Math.abs(diff - 7 * 24 * 60 * 60 * 1000) < tolerance) {
                setSelectedPreset('7d');
                setShowCustom(false);
            } else if (Math.abs(diff - 30 * 24 * 60 * 60 * 1000) < tolerance) {
                setSelectedPreset('30d');
                setShowCustom(false);
            } else if (Math.abs(diff - 90 * 24 * 60 * 60 * 1000) < tolerance) {
                setSelectedPreset('90d');
                setShowCustom(false);
            } else {
                setSelectedPreset('custom');
                setShowCustom(true);
            }
        }
    }, [value]);

    const handlePresetClick = (preset: PresetKey) => {
        setSelectedPreset(preset);
        
        if (preset === 'never') {
            onChange('');
            setShowCustom(false);
        } else if (preset === 'custom') {
            setShowCustom(true);
            // Keep existing value or set to 24h from now as default
            if (!value) {
                const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
                onChange(toLocalDateTimeValue(defaultDate));
            }
        } else {
            const date = presets[preset].getDate();
            if (date) {
                onChange(toLocalDateTimeValue(date));
            }
            setShowCustom(false);
        }
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleClear = () => {
        onChange('');
        setSelectedPreset('never');
        setShowCustom(false);
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.625rem 0.875rem',
        borderRadius: '4px',
        border: '1px solid #3a3a3a',
        backgroundColor: '#1a1a1a',
        color: '#e0e0e0',
        fontSize: '0.875rem',
        outline: 'none',
    };

    const presetButtonStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '0.375rem 0.625rem',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: isActive ? '#ffffff' : '#9ca3af',
        backgroundColor: isActive ? '#2563eb' : 'transparent',
        border: `1px solid ${isActive ? '#3b82f6' : '#3a3a3a'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap' as const,
    });

    return (
        <div>
            {showLabel && (
                <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: '#9ca3af',
                    marginBottom: '0.5rem',
                }}>{label}</label>
            )}
            
            {/* Quick Presets */}
            <div style={{ 
                display: 'flex', 
                gap: '0.375rem', 
                flexWrap: 'wrap',
                marginBottom: '0.75rem',
            }}>
                {(Object.keys(presets) as PresetKey[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handlePresetClick(key)}
                        style={presetButtonStyle(selectedPreset === key)}
                        onMouseEnter={(e) => {
                            if (selectedPreset !== key) {
                                e.currentTarget.style.backgroundColor = '#252525';
                                e.currentTarget.style.borderColor = '#4a4a4a';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (selectedPreset !== key) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = '#3a3a3a';
                            }
                        }}
                    >
                        {presets[key].label}
                    </button>
                ))}
            </div>

            {/* Custom Date/Time Input */}
            {showCustom && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="datetime-local"
                            value={value}
                            onChange={handleCustomChange}
                            min={toLocalDateTimeValue(new Date())}
                            style={{ ...inputStyle, flex: 1 }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#3a3a3a';
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleClear}
                            style={{
                                padding: '0.625rem',
                                fontSize: '0.8rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.borderColor = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#9ca3af';
                                e.currentTarget.style.borderColor = '#3a3a3a';
                            }}
                            title="Clear expiry"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Preview */}
            <p style={{
                margin: '0.25rem 0 0 0',
                fontSize: '0.75rem',
                color: value ? (new Date(value) < new Date() ? '#f87171' : '#22c55e') : '#6b7280',
                fontStyle: value ? 'normal' : 'italic',
            }}>
                {formatPreviewDate(value)}
            </p>
            
            {helperText && !value && (
                <p style={{
                    margin: '0.125rem 0 0 0',
                    fontSize: '0.7rem',
                    color: '#6b7280',
                }}>{helperText}</p>
            )}
        </div>
    );
}
