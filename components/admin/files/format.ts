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

export { formatFileSize as formatSize } from '@/lib/utils/fileTypes';

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
