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
    duration: number | null;
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
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
    
    if (days > 0) return days === 1 ? '1 day' : `${days} days`;
    if (hours > 0) return hours === 1 ? '1 hour' : `${hours} hours`;
    if (minutes > 0) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    return 'less than a minute';
}

// DateTime Picker Modal Component
function DateTimePickerModal({
    isOpen,
    onClose,
    onConfirm,
    initialDate,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    initialDate: Date;
}) {
    const [viewYear, setViewYear] = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
    const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
    const [selectedHour, setSelectedHour] = useState(initialDate.getHours() % 12 || 12);
    const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());
    const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initialDate.getHours() >= 12 ? 'PM' : 'AM');
    
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);
    const periodRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setViewYear(initialDate.getFullYear());
            setViewMonth(initialDate.getMonth());
            setSelectedDay(initialDate.getDate());
            setSelectedHour(initialDate.getHours() % 12 || 12);
            setSelectedMinute(initialDate.getMinutes());
            setSelectedPeriod(initialDate.getHours() >= 12 ? 'PM' : 'AM');
        }
    }, [isOpen, initialDate]);

    // Scroll to selected values on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                hourRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
                minuteRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
                periodRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
            }, 50);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    const handleConfirm = () => {
        let hour24 = selectedHour;
        if (selectedPeriod === 'PM' && selectedHour !== 12) hour24 += 12;
        if (selectedPeriod === 'AM' && selectedHour === 12) hour24 = 0;
        const date = new Date(viewYear, viewMonth, selectedDay, hour24, selectedMinute);
        onConfirm(date);
    };

    const isDateDisabled = (day: number) => {
        const date = new Date(viewYear, viewMonth, day);
        date.setHours(0, 0, 0, 0);
        return date < today;
    };

    const isToday = (day: number) => {
        const date = new Date(viewYear, viewMonth, day);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === today.getTime();
    };

    const scrollItemStyle = (isSelected: boolean): React.CSSProperties => ({
        padding: '0.5rem 1rem',
        textAlign: 'center',
        cursor: 'pointer',
        color: isSelected ? '#3b82f6' : '#9ca3af',
        fontWeight: isSelected ? 600 : 400,
        fontSize: '0.9rem',
        transition: 'all 0.15s',
        borderRadius: '4px',
    });

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
        }} onClick={onClose}>
            <div 
                style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #2a2a2a',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    display: 'flex',
                    overflow: 'hidden',
                    maxWidth: '95vw',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Calendar Side */}
                <div style={{ padding: '1rem', borderRight: '1px solid #2a2a2a' }}>
                    {/* Month/Year Header */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '1rem',
                    }}>
                        <span style={{ 
                            color: '#e0e0e0', 
                            fontWeight: 500,
                            fontSize: '0.9rem',
                        }}>
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '4px',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '4px',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Weekday Headers */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 32px)',
                        gap: '2px',
                        marginBottom: '0.5rem',
                    }}>
                        {WEEKDAYS.map((day, i) => (
                            <div key={i} style={{
                                textAlign: 'center',
                                color: '#6b7280',
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                padding: '0.25rem',
                            }}>
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 32px)',
                        gap: '2px',
                    }}>
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} style={{ width: '32px', height: '32px' }} />
                        ))}
                        
                        {/* Day cells */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const disabled = isDateDisabled(day);
                            const selected = day === selectedDay && viewMonth === initialDate.getMonth() && viewYear === initialDate.getFullYear() ? day === selectedDay : day === selectedDay;
                            const isTodayDate = isToday(day);
                            
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => setSelectedDay(day)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: selected ? '#2563eb' : 'transparent',
                                        border: isTodayDate && !selected ? '1px solid #4b5563' : 'none',
                                        borderRadius: '50%',
                                        color: disabled ? '#4b5563' : selected ? '#ffffff' : '#e0e0e0',
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: selected ? 600 : 400,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Time Picker Side */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', flex: 1 }}>
                        {/* Hour Column */}
                        <div 
                            ref={hourRef}
                            style={{ 
                                width: '60px', 
                                height: '220px',
                                overflowY: 'auto',
                                borderRight: '1px solid #2a2a2a',
                                padding: '0.5rem 0',
                            }}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                <div
                                    key={h}
                                    data-selected={selectedHour === h}
                                    onClick={() => setSelectedHour(h)}
                                    style={scrollItemStyle(selectedHour === h)}
                                    onMouseEnter={(e) => {
                                        if (selectedHour !== h) e.currentTarget.style.backgroundColor = '#252525';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedHour !== h) e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    {String(h).padStart(2, '0')}
                                </div>
                            ))}
                        </div>

                        {/* Minute Column */}
                        <div 
                            ref={minuteRef}
                            style={{ 
                                width: '60px', 
                                height: '220px',
                                overflowY: 'auto',
                                borderRight: '1px solid #2a2a2a',
                                padding: '0.5rem 0',
                            }}
                        >
                            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                                <div
                                    key={m}
                                    data-selected={selectedMinute === m}
                                    onClick={() => setSelectedMinute(m)}
                                    style={scrollItemStyle(selectedMinute === m)}
                                    onMouseEnter={(e) => {
                                        if (selectedMinute !== m) e.currentTarget.style.backgroundColor = '#252525';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedMinute !== m) e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    {String(m).padStart(2, '0')}
                                </div>
                            ))}
                        </div>

                        {/* AM/PM Column */}
                        <div 
                            ref={periodRef}
                            style={{ 
                                width: '60px', 
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                padding: '0.5rem',
                                gap: '0.5rem',
                            }}
                        >
                            {(['AM', 'PM'] as const).map((p) => (
                                <div
                                    key={p}
                                    data-selected={selectedPeriod === p}
                                    onClick={() => setSelectedPeriod(p)}
                                    style={{
                                        ...scrollItemStyle(selectedPeriod === p),
                                        padding: '0.75rem 0.5rem',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (selectedPeriod !== p) e.currentTarget.style.backgroundColor = '#252525';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedPeriod !== p) e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    {p}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'flex-end',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        borderTop: '1px solid #2a2a2a',
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            CANCEL
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                color: '#3b82f6',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
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
    const [showPicker, setShowPicker] = useState(false);
    const userClickedCustom = useRef(false);
    const lastSetPreset = useRef<PresetKey | null>(null);

    // Initialize preset based on value
    useEffect(() => {
        if (userClickedCustom.current) {
            userClickedCustom.current = false;
            return;
        }
        
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
            if (!value) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(12, 0, 0, 0);
                onChange(toLocalDateTimeValue(tomorrow));
            }
            setShowPicker(true);
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

    const handleClear = () => {
        onChange('');
        setSelectedPreset('never');
        setShowCustom(false);
    };

    const handleDateTimeConfirm = (date: Date) => {
        onChange(toLocalDateTimeValue(date));
        setShowPicker(false);
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

    const currentDate = value ? new Date(value) : new Date();
    const formattedDate = value 
        ? `${MONTHS_SHORT[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()} at ${currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';

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

            {/* Custom Date Display */}
            {showCustom && value && (
                <div style={{ 
                    marginBottom: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: '#1f1f1f',
                    borderRadius: '6px',
                    border: '1px solid #2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                }}>
                    <button
                        type="button"
                        onClick={() => setShowPicker(true)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#e0e0e0',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{formattedDate}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        style={{
                            padding: '0.375rem',
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                        title="Clear expiry"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
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

            {/* DateTime Picker Modal */}
            <DateTimePickerModal
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                onConfirm={handleDateTimeConfirm}
                initialDate={value ? new Date(value) : new Date()}
            />
        </div>
    );
}
