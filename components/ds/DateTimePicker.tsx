'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { SegmentedControl } from './SegmentedControl';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export interface DatePreset {
    /** Stable key, e.g. "7d" */
    key: string;
    label: string;
    /** Days from now; null = no end date */
    days: number | null;
}

export const DEFAULT_PRESETS: DatePreset[] = [
    { key: 'never', label: 'No end date', days: null },
    { key: '1d', label: '1 day', days: 1 },
    { key: '7d', label: '7 days', days: 7 },
    { key: '30d', label: '30 days', days: 30 },
];

export interface DateTimePickerProps {
    value: Date | null;
    onChange: (value: Date | null) => void;
    /** Accessible name for the preset group, e.g. "Access ends" */
    label: string;
    presets?: DatePreset[];
    /** Earliest selectable moment (defaults to now) */
    min?: Date;
    className?: string;
}

function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function relative(ms: number) {
    const days = Math.round(ms / DAY);
    if (days >= 2) return `in ${days} days`;
    const hours = Math.round(ms / (60 * 60 * 1000));
    if (hours >= 2) return `in ${hours} hours`;
    return 'in less than 2 hours';
}

/** End-date picker: presets for the common cases, a neutral calendar + time for a custom moment. */
export function DateTimePicker({ value, onChange, label, presets = DEFAULT_PRESETS, min, className }: DateTimePickerProps) {
    const [now] = useState(() => Date.now());
    const minDate = useMemo(() => min ?? new Date(now), [min, now]);
    const [mode, setMode] = useState<string>(() => {
        if (!value) return presets.find((p) => p.days === null)?.key ?? 'custom';
        const match = presets.find((p) => p.days !== null && Math.abs(value.getTime() - (now + p.days * DAY)) < 5 * 60 * 1000);
        return match?.key ?? 'custom';
    });
    const [viewMonth, setViewMonth] = useState(() => {
        const base = value ?? new Date(now + 7 * DAY);
        return new Date(base.getFullYear(), base.getMonth(), 1);
    });
    const timeId = useId();

    const choosePreset = (key: string) => {
        setMode(key);
        if (key === 'custom') {
            if (!value) {
                const d = new Date(now + 7 * DAY);
                d.setHours(18, 0, 0, 0);
                onChange(d);
            }
            return;
        }
        const preset = presets.find((p) => p.key === key);
        onChange(preset?.days == null ? null : new Date(Date.now() + preset.days * DAY));
    };

    const pickDay = (day: Date) => {
        const next = new Date(day);
        next.setHours(value?.getHours() ?? 18, value?.getMinutes() ?? 0, 0, 0);
        onChange(next < minDate ? new Date(minDate.getTime() + 60 * 60 * 1000) : next);
    };

    const setTime = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return;
        const next = new Date(value ?? new Date(now + DAY));
        next.setHours(h, m, 0, 0);
        onChange(next);
    };

    const days = useMemo(() => {
        const first = new Date(viewMonth);
        const offset = (first.getDay() + 6) % 7; // Monday first
        const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
        return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }, [viewMonth]);

    const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const minDay = startOfDay(minDate);
    const time = value ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` : '18:00';

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <SegmentedControl
                label={label}
                value={mode}
                onChange={choosePreset}
                options={[...presets.map((p) => ({ value: p.key, label: p.label })), { value: 'custom', label: 'Custom' }]}
                className="max-w-full flex-wrap"
            />

            {mode === 'custom' && (
                <div className="w-full max-w-[300px] rounded-lg border border-default bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            type="button"
                            aria-label="Previous month"
                            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-raised hover:text-primary focus-ring"
                        >
                            <ChevronLeft aria-hidden strokeWidth={1.75} className="h-4 w-4" />
                        </button>
                        <span className="text-body-sm font-medium text-strong" aria-live="polite">
                            {monthLabel}
                        </span>
                        <button
                            type="button"
                            aria-label="Next month"
                            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-raised hover:text-primary focus-ring"
                        >
                            <ChevronRight aria-hidden strokeWidth={1.75} className="h-4 w-4" />
                        </button>
                    </div>
                    <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-0.5 text-center">
                        {WEEKDAYS.map((d) => (
                            <span key={d} role="columnheader" className="pb-1 text-caption text-tertiary">
                                {d}
                            </span>
                        ))}
                        {days.map((day) => {
                            const outside = day.getMonth() !== viewMonth.getMonth();
                            const disabled = day < minDay;
                            const selected = value ? sameDay(day, value) : false;
                            const today = sameDay(day, new Date(now));
                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    role="gridcell"
                                    aria-selected={selected}
                                    aria-label={day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                    disabled={disabled}
                                    onClick={() => pickDay(day)}
                                    className={cn(
                                        'h-8 rounded-md text-body-sm tabular-nums transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-30',
                                        selected
                                            ? 'bg-gray-10 font-medium text-gray-1'
                                            : outside
                                              ? 'text-tertiary hover:bg-raised'
                                              : 'text-primary hover:bg-raised',
                                        today && !selected && 'ring-1 ring-inset ring-gray-6'
                                    )}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-subtle pt-3">
                        <label htmlFor={timeId} className="text-caption font-medium text-secondary">
                            Time
                        </label>
                        <input
                            id={timeId}
                            type="time"
                            value={time}
                            onChange={(event) => setTime(event.target.value)}
                            className="h-8 rounded-md border border-default bg-raised px-2 text-body tabular-nums text-primary [color-scheme:dark] hover:border-strong focus:border-gray-8 focus:outline-none focus:ring-2 focus:ring-white/15"
                        />
                    </div>
                </div>
            )}

            <p className="text-caption text-tertiary" aria-live="polite">
                {value
                    ? `Access ends ${value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: value.getFullYear() !== new Date(now).getFullYear() ? 'numeric' : undefined })} at ${value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${relative(value.getTime() - now)}`
                    : 'Access stays open until you remove it.'}
            </p>
        </div>
    );
}
