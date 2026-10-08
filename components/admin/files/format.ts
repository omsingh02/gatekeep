/** "1 file", "3 files", "1 folder" */
export function count(n: number, singular: string, plural = `${singular}s`): string {
    return `${n} ${n === 1 ? singular : plural}`;
}

/** "3 files", "1 folder", "2 files and 1 folder" */
export function describeItems(files: number, folders: number): string {
    if (files && folders) return `${count(files, 'file')} and ${count(folders, 'folder')}`;
    if (folders) return count(folders, 'folder');
    return count(files, 'file');
}

const UNITS = ['KB', 'MB', 'GB', 'TB'];

/** "512 bytes", "4.1 KB", "2.3 MB", "196 MB": one decimal under 100, none above. */
export function formatSize(bytes: number | null | undefined): string {
    if (!bytes || bytes < 0) return '0 bytes';
    if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const rounded = value >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString();
    return `${rounded} ${UNITS[unit]}`;
}

/** Compact date for tables: "2:05 PM" today, "Oct 6" this year, "Oct 6, 2025" before. */
export function formatShortDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    });
}

/** Full date and time for tooltips and metadata: "Oct 6, 2026, 2:05 PM" */
export function formatFullDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Where "Send" goes: the new-delivery flow with these files preselected. */
export function sendHref(fileIds: string[]): string {
    return `/admin/deliveries/new?files=${fileIds.map(encodeURIComponent).join(',')}`;
}
