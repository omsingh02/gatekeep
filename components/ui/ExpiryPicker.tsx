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

/** Match a value to the preset it was most likely created from (±2 min), else 'custom'. */
function detectPreset(value: string): PresetKey {
    if (!value) return 'never';
    const diff = new Date(value).getTime() - Date.now();
    const tolerance = 2 * 60 * 1000;
    const hour = 60 * 60 * 1000;
    const candidates: Array<[PresetKey, number]> = [
        ['1h', hour],
        ['24h', 24 * hour],
        ['7d', 7 * 24 * hour],
        ['30d', 30 * 24 * hour],
        ['90d', 90 * 24 * hour],
    ];
    const match = candidates.find(([, duration]) => Math.abs(diff - duration) < tolerance);
    return match ? match[0] : 'custom';
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
    // The parent mounts this modal only while it is open, so state is
    // initialised from initialDate each time the picker is shown.
    const [viewYear, setViewYear] = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
    const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
    const [selectedHour, setSelectedHour] = useState(initialDate.getHours() % 12 || 12);
    const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());
    const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initialDate.getHours() >= 12 ? 'PM' : 'AM');
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);
    const periodRef = useRef<HTMLDivElement>(null);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

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

    // Close year dropdown when clicking outside
    useEffect(() => {
        if (showYearDropdown) {
            const handleClickOutside = (e: MouseEvent) => {
                if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
                    setShowYearDropdown(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showYearDropdown]);

    if (!isOpen) return null;

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear + i);

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
        padding: '0.75rem 1.25rem',
        textAlign: 'center',
        cursor: 'pointer',
        color: isSelected ? '#6366f1' : '#9ca3af',
        fontWeight: isSelected ? 600 : 400,
        fontSize: '1rem',
        transition: 'all 0.15s',
        borderRadius: '6px',
    });

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
        }} onClick={onClose}>
            <div 
                style={{
                    backgroundColor: '#12141c',
                    borderRadius: '8px',
                    border: '1px solid #23263a',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    overflow: 'hidden',
                    maxWidth: '95vw',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Calendar Side */}
                <div style={{ padding: '1.5rem', borderRight: '1px solid #23263a' }}>
                    {/* Month/Year Header */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '1.25rem',
                        gap: '1rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }} ref={yearDropdownRef}>
                            <span style={{ 
                                color: '#e0e0e0', 
                                fontWeight: 600,
                                fontSize: '1.1rem',
                            }}>
                                {MONTHS[viewMonth]}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowYearDropdown(!showYearDropdown)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.375rem 0.625rem',
                                    backgroundColor: showYearDropdown ? '#12141c' : 'transparent',
                                    border: '1px solid #2c2f42',
                                    borderRadius: '6px',
                                    color: '#e0e0e0',
                                    fontWeight: 600,
                                    fontSize: '1.1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {viewYear}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>
                            
                            {/* Year Dropdown */}
                            {showYearDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    marginTop: '0.5rem',
                                    backgroundColor: '#0b0c11',
                                    border: '2px solid #2c2f42',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 10,
                                    minWidth: '100px',
                                }}>
                                    {yearOptions.map((year) => (
                                        <button
                                            key={year}
                                            type="button"
                                            onClick={() => {
                                                setViewYear(year);
                                                setShowYearDropdown(false);
                                            }}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '0.75rem 1rem',
                                                backgroundColor: viewYear === year ? '#4f46e5' : 'transparent',
                                                border: 'none',
                                                color: viewYear === year ? '#ffffff' : '#e0e0e0',
                                                fontWeight: viewYear === year ? 600 : 400,
                                                fontSize: '1rem',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'background-color 0.15s',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (viewYear !== year) e.currentTarget.style.backgroundColor = '#12141c';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (viewYear !== year) e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                        >
                                            {year}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#0b0c11',
                                    border: '2px solid #2c2f42',
                                    borderRadius: '8px',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#12141c';
                                    e.currentTarget.style.borderColor = '#3a3e55';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#0b0c11';
                                    e.currentTarget.style.borderColor = '#2c2f42';
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#0b0c11',
                                    border: '2px solid #2c2f42',
                                    borderRadius: '8px',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#12141c';
                                    e.currentTarget.style.borderColor = '#3a3e55';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#0b0c11';
                                    e.currentTarget.style.borderColor = '#2c2f42';
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Weekday Headers */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 44px)',
                        gap: '4px',
                        marginBottom: '0.75rem',
                    }}>
                        {WEEKDAYS.map((day, i) => (
                            <div key={i} style={{
                                textAlign: 'center',
                                color: '#6b7280',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                padding: '0.5rem',
                                textTransform: 'uppercase',
                            }}>
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 44px)',
                        gap: '4px',
                    }}>
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} style={{ width: '44px', height: '44px' }} />
                        ))}
                        
                        {/* Day cells */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const disabled = isDateDisabled(day);
                            const selected = day === selectedDay;
                            const isTodayDate = isToday(day);
                            
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => setSelectedDay(day)}
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: selected ? '#4f46e5' : 'transparent',
                                        border: isTodayDate && !selected ? '2px solid #3a3e55' : selected ? '2px solid #6366f1' : '2px solid transparent',
                                        borderRadius: '8px',
                                        color: disabled ? '#4b5563' : selected ? '#ffffff' : '#e0e0e0',
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        fontSize: '1rem',
                                        fontWeight: selected ? 700 : 500,
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!disabled && !selected) {
                                            e.currentTarget.style.backgroundColor = '#151823';
                                            e.currentTarget.style.borderColor = '#3a3e55';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!disabled && !selected) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.borderColor = isTodayDate ? '#3a3e55' : 'transparent';
                                        }
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Time Picker Side */}
                <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#151823' }}>
                    {/* Time Header */}
                    <div style={{
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid #23263a',
                        textAlign: 'center',
                    }}>
                        <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Select Time
                        </span>
                    </div>
                    
                    <div style={{ display: 'flex', flex: 1 }}>
                        {/* Hour Column */}
                        <div 
                            ref={hourRef}
                            style={{ 
                                width: '80px', 
                                height: '280px',
                                overflowY: 'auto',
                                borderRight: '1px solid #23263a',
                                padding: '0.75rem 0',
                            }}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                <div
                                    key={h}
                                    data-selected={selectedHour === h}
                                    onClick={() => setSelectedHour(h)}
                                    style={scrollItemStyle(selectedHour === h)}
                                    onMouseEnter={(e) => {
                                        if (selectedHour !== h) e.currentTarget.style.backgroundColor = '#151823';
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
                                width: '80px', 
                                height: '280px',
                                overflowY: 'auto',
                                borderRight: '1px solid #23263a',
                                padding: '0.75rem 0',
                            }}
                        >
                            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                                <div
                                    key={m}
                                    data-selected={selectedMinute === m}
                                    onClick={() => setSelectedMinute(m)}
                                    style={scrollItemStyle(selectedMinute === m)}
                                    onMouseEnter={(e) => {
                                        if (selectedMinute !== m) e.currentTarget.style.backgroundColor = '#151823';
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
                                width: '80px', 
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                padding: '1rem',
                                gap: '0.75rem',
                            }}
                        >
                            {(['AM', 'PM'] as const).map((p) => (
                                <div
                                    key={p}
                                    data-selected={selectedPeriod === p}
                                    onClick={() => setSelectedPeriod(p)}
                                    style={{
                                        padding: '0.875rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: selectedPeriod === p ? '#ffffff' : '#9ca3af',
                                        backgroundColor: selectedPeriod === p ? '#4f46e5' : 'transparent',
                                        border: selectedPeriod === p ? '1px solid #6366f1' : '1px solid #23263a',
                                        fontWeight: selectedPeriod === p ? 600 : 500,
                                        fontSize: '0.9rem',
                                        transition: 'all 0.15s',
                                        borderRadius: '6px',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (selectedPeriod !== p) {
                                            e.currentTarget.style.backgroundColor = '#23263a';
                                            e.currentTarget.style.borderColor = '#2f3349';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedPeriod !== p) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.borderColor = '#23263a';
                                        }
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
                        gap: '0.75rem',
                        padding: '1rem 1.25rem',
                        borderTop: '1px solid #23263a',
                        backgroundColor: '#12141c',
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '2px solid #2c2f42',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#151823';
                                e.currentTarget.style.borderColor = '#3a3e55';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = '#2c2f42';
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                color: '#ffffff',
                                backgroundColor: '#4f46e5',
                                border: '2px solid #6366f1',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#4338ca';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#4f46e5';
                            }}
                        >
                            Confirm
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
    const [selectedPreset, setSelectedPreset] = useState<PresetKey>(() => detectPreset(value));
    const [showCustom, setShowCustom] = useState(() => detectPreset(value) === 'custom');
    const [showPicker, setShowPicker] = useState(false);
    // Value this picker last emitted itself; those changes keep the preset the user clicked
    const [ownValue, setOwnValue] = useState<string | null>(null);
    const [prevValue, setPrevValue] = useState(value);

    // Re-detect the preset when the value is changed from outside (form reset, editing a grant)
    if (value !== prevValue) {
        setPrevValue(value);
        if (value === ownValue) {
            setOwnValue(null);
        } else {
            const preset = detectPreset(value);
            setSelectedPreset(preset);
            setShowCustom(preset === 'custom');
        }
    }

    const emitChange = (next: string) => {
        setOwnValue(next);
        onChange(next);
    };

    const handlePresetClick = (preset: PresetKey) => {
        setSelectedPreset(preset);
        
        if (preset === 'never') {
            emitChange('');
            setShowCustom(false);
        } else if (preset === 'custom') {
            setShowCustom(true);
            if (!value) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(12, 0, 0, 0);
                emitChange(toLocalDateTimeValue(tomorrow));
            }
            setShowPicker(true);
        } else {
            const duration = presets[preset].duration;
            if (duration) {
                const date = new Date();
                date.setTime(date.getTime() + duration);
                emitChange(toLocalDateTimeValue(date));
            }
            setShowCustom(false);
        }
    };

    const handleClear = () => {
        emitChange('');
        setSelectedPreset('never');
        setShowCustom(false);
    };

    const handleDateTimeConfirm = (date: Date) => {
        emitChange(toLocalDateTimeValue(date));
        setShowPicker(false);
    };

    const presetButtonStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '0.375rem 0.625rem',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: isActive ? '#ffffff' : '#9ca3af',
        backgroundColor: isActive ? '#4f46e5' : 'transparent',
        border: `1px solid ${isActive ? '#6366f1' : '#23263a'}`,
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
                                e.currentTarget.style.backgroundColor = '#151823';
                                e.currentTarget.style.borderColor = '#2f3349';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (selectedPreset !== key) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = '#23263a';
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
                    backgroundColor: '#0f1117',
                    borderRadius: '6px',
                    border: '1px solid #12141c',
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
            {showPicker && (
                <DateTimePickerModal
                    isOpen={showPicker}
                    onClose={() => setShowPicker(false)}
                    onConfirm={handleDateTimeConfirm}
                    initialDate={value ? new Date(value) : new Date()}
                />
            )}
        </div>
    );
}
