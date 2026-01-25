/**
 * Format a date/time string for display
 * Provides consistent formatting across the app
 */

export function formatDateTime(
    dateString: string | Date,
    options: {
        includeTime?: boolean;
        relative?: boolean;
    } = {}
): string {
    const { includeTime = true, relative = false } = options;
    const date = new Date(dateString);
    const now = new Date();

    // For relative time (e.g., "2 hours ago")
    if (relative) {
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
    }

    // Standard date/time format
    if (includeTime) {
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    // Date only
    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
}

/**
 * Format a date for "Created" or "Expires" labels
 * Shows relative time for recent dates, full date/time otherwise
 */
export function formatDateLabel(dateString: string | Date, prefix?: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - date.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);

    // For dates within 24 hours, show relative time
    if (diffHours < 24) {
        const isFuture = date > now;
        const hours = Math.floor(diffHours);
        const mins = Math.floor((diffMs / (1000 * 60)) % 60);
        
        if (hours < 1) {
            const timeStr = mins < 1 ? 'now' : `${mins}m`;
            return prefix ? `${prefix} ${isFuture ? `in ${timeStr}` : timeStr + ' ago'}` : timeStr;
        }
        const timeStr = `${hours}h ${mins}m`;
        return prefix ? `${prefix} ${isFuture ? `in ${timeStr}` : timeStr + ' ago'}` : timeStr;
    }

    // For dates further away, show full date/time
    const formatted = formatDateTime(dateString, { includeTime: true });
    return prefix ? `${prefix} ${formatted}` : formatted;
}
