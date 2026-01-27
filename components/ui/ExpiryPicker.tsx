'use client';

import { useState, useEffect, useRef } from 'react';

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
    duration: number | null; // in milliseconds, null for never/custom
}

const presets: Record<PresetKey, Preset> = {
    '1h': { label: '1 Hour', duration: 60 * 60 * 1000 },
    '24h': { label: '24 Hours', duration: 24 * 60 * 60 * 1000 },
    '7d': { label: '7 Days', duration: 7 * 24 * 60 * 60 * 1000 },
    '30d': { label: '30 Days', duration: 30 * 24 * 60 * 60 * 1000 },
    '90d': { label: '90 Days', duration: 90 * 24 * 60 * 60 * 1000 },
    'custom': { label: 'Custom', duration: null },
    'never': { label: 'Never', duration: null },
};

const presetLabels: Record<Exclude<PresetKey, 'custom' | 'never'>, string> = {
    '1h': '1 hour',
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
};

function toLocalDateTimeValue(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatPreviewDate(value: string, activePreset: PresetKey | null): string {
    if (!value) return 'No expiry (permanent)';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    
    if (diff < 0) {
        return `Expired ${formatRelative(-diff)} ago`;
    }
    
    // If a preset is active, show the preset label instead of calculated time
    if (activePreset && activePreset !== 'custom' && activePreset !== 'never') {
        const label = presetLabels[activePreset];
        return `Expires in ${label} (${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    }
    
    return `Expires in ${formatRelative(diff)} (${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
}

function formatRelative(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    
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
    const userClickedCustom = useRef(false);
    const lastSetPreset = useRef<PresetKey | null>(null);

    // Custom date/time state
    const [customDate, setCustomDate] = useState('');
    const [customTime, setCustomTime] = useState('12:00');

    // Initialize preset based on value (only on mount or when value changes externally)
    useEffect(() => {
        // Skip if user explicitly clicked custom
        if (userClickedCustom.current) {
            userClickedCustom.current = false;
            return;
        }
        
        // Skip if this change was from a preset we just set
        if (lastSetPreset.current) {
            lastSetPreset.current = null;
            return;
        }

        if (!value) {
            setSelectedPreset('never');
            setShowCustom(false);
        } else {
            const targetDate = new Date(value).getTime();
            const now = Date.now();
            const diff = targetDate - now;
            
            // Check preset matches (with 2 minute tolerance)
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
                // Initialize custom date/time from value
                const d = new Date(value);
                setCustomDate(d.toISOString().split('T')[0]);
                setCustomTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
            }
        }
    }, [value]);

    const handlePresetClick = (preset: PresetKey) => {
        if (preset === 'custom') {
            userClickedCustom.current = true;
        }
        lastSetPreset.current = preset;
        setSelectedPreset(preset);
        
        if (preset === 'never') {
            onChange('');
            setShowCustom(false);
        } else if (preset === 'custom') {
            setShowCustom(true);
            // Set default to tomorrow at noon if no value
            if (!value) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(12, 0, 0, 0);
                setCustomDate(tomorrow.toISOString().split('T')[0]);
                setCustomTime('12:00');
                onChange(toLocalDateTimeValue(tomorrow));
            } else {
                // Parse existing value into date and time
                const d = new Date(value);
                setCustomDate(d.toISOString().split('T')[0]);
                setCustomTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
            }
        } else {
            const duration = presets[preset].duration;
            if (duration) {
                const date = new Date(Date.now() + duration);
                lastSetPreset.current = preset;
                onChange(toLocalDateTimeValue(date));
            }
            setShowCustom(false);
        }
    };

    const handleCustomDateChange = (newDate: string) => {
        setCustomDate(newDate);
        if (newDate && customTime) {
            const combined = new Date(`${newDate}T${customTime}`);
            onChange(toLocalDateTimeValue(combined));
        }
    };

    const handleCustomTimeChange = (newTime: string) => {
        setCustomTime(newTime);
        if (customDate && newTime) {
            const combined = new Date(`${customDate}T${newTime}`);
            onChange(toLocalDateTimeValue(combined));
        }
    };

    const handleClear = () => {
        onChange('');
        setSelectedPreset('never');
        setShowCustom(false);
        setCustomDate('');
        setCustomTime('12:00');
    };

    const inputStyle: React.CSSProperties = {
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

    // Generate time options (every 30 minutes)
    const timeOptions: string[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }

    const formatTimeLabel = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
    };

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

            {/* Custom Date/Time Inputs */}
            {showCustom && (
                <div style={{ 
                    marginBottom: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: '#252525',
                    borderRadius: '6px',
                    border: '1px solid #3a3a3a',
                }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {/* Date Input */}
                        <div style={{ flex: '1 1 140px', minWidth: '140px' }}>
                            <label style={{ 
                                display: 'block', 
                                fontSize: '0.7rem', 
                                color: '#6b7280',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>Date</label>
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => handleCustomDateChange(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                style={{ ...inputStyle, width: '100%' }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#3a3a3a'}
                            />
                        </div>

                        {/* Time Select */}
                        <div style={{ flex: '1 1 120px', minWidth: '120px' }}>
                            <label style={{ 
                                display: 'block', 
                                fontSize: '0.7rem', 
                                color: '#6b7280',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>Time</label>
                            <select
                                value={customTime}
                                onChange={(e) => handleCustomTimeChange(e.target.value)}
                                style={{ 
                                    ...inputStyle, 
                                    width: '100%',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '1.25rem',
                                    paddingRight: '2rem',
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#3a3a3a'}
                            >
                                {timeOptions.map((time) => (
                                    <option key={time} value={time}>
                                        {formatTimeLabel(time)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Clear Button */}
                        <button
                            type="button"
                            onClick={handleClear}
                            style={{
                                padding: '0.625rem 0.875rem',
                                fontSize: '0.8rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                            <span>Clear</span>
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
                {formatPreviewDate(value, selectedPreset)}
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
