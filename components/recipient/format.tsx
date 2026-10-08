import {
    File,
    FileArchive,
    FileAudio,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileVideo,
    Presentation,
} from 'lucide-react';
import { cn } from '@/components/ds';
import { formatFileSize, getFileExtension } from '@/lib/utils/fileTypes';

export { formatFileSize };

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'office' | 'none';

const TEXT_TYPES = new Set(['application/json', 'application/javascript', 'application/xml', 'text/javascript']);
const OFFICE = /officedocument|msword|ms-excel|ms-powerpoint/;
const SPREADSHEET = /spreadsheet|ms-excel|text\/csv/;
const SLIDES = /presentation|ms-powerpoint/;
const ARCHIVE = /zip|tar|gzip|rar|7z/;
const CODE = /json|javascript|xml|html|css/;

/** How a file can be shown in the browser. */
export function previewKind(mimeType: string): PreviewKind {
    const mime = mimeType.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('text/') || TEXT_TYPES.has(mime)) return 'text';
    if (OFFICE.test(mime)) return 'office';
    return 'none';
}

/** Monochrome file-type icon (docs/DESIGN.md: no per-type colours). One stable component, never created in render. */
export function FileTypeIcon({ mimeType, className = 'h-5 w-5' }: { mimeType: string; className?: string }) {
    const props = { strokeWidth: 1.75, 'aria-hidden': true, className } as const;
    const mime = mimeType.toLowerCase();
    if (mime.startsWith('image/')) return <FileImage {...props} />;
    if (mime.startsWith('video/')) return <FileVideo {...props} />;
    if (mime.startsWith('audio/')) return <FileAudio {...props} />;
    if (SPREADSHEET.test(mime)) return <FileSpreadsheet {...props} />;
    if (SLIDES.test(mime)) return <Presentation {...props} />;
    if (ARCHIVE.test(mime)) return <FileArchive {...props} />;
    if (mime === 'application/pdf' || OFFICE.test(mime)) return <FileText {...props} />;
    if (CODE.test(mime)) return <FileCode {...props} />;
    if (mime.startsWith('text/')) return <FileText {...props} />;
    return <File {...props} />;
}

const tileSizes = {
    sm: ['h-8 w-8', 'h-4 w-4'],
    md: ['h-10 w-10', 'h-5 w-5'],
    lg: ['h-12 w-12', 'h-6 w-6'],
} as const;

/** The file-type icon in a bordered tile. */
export function FileTile({ mimeType, size = 'md' }: { mimeType: string; size?: keyof typeof tileSizes }) {
    const [box, icon] = tileSizes[size];
    return (
        <span className={cn('flex shrink-0 items-center justify-center rounded-md border border-default bg-raised text-secondary', box)}>
            <FileTypeIcon mimeType={mimeType} className={icon} />
        </span>
    );
}

/** "PDF · 2.3 MB" */
export function fileMeta(file: { name: string; size: number }): string {
    const extension = getFileExtension(file.name).toUpperCase();
    return extension ? `${extension} · ${formatFileSize(file.size)}` : formatFileSize(file.size);
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "in 6 days", "tomorrow", "in 5 hours" */
export function relativeTime(iso: string, now = Date.now()): string {
    const diff = new Date(iso).getTime() - now;
    const minutes = Math.round(diff / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    const hours = Math.round(diff / 3_600_000);
    if (Math.abs(hours) < 36) return relative.format(hours, 'hour');
    return relative.format(Math.round(diff / 86_400_000), 'day');
}

/** "Oct 14 · in 6 days", with the time when it's close: "Oct 9, 3:00 PM · in 5 hours" */
export function endsLabel(iso: string, now = Date.now()): string {
    const date = new Date(iso);
    const soon = date.getTime() - now < 2 * 86_400_000;
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
    const time = soon ? `, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : '';
    return `${day}${time} · ${relativeTime(iso, now)}`;
}

/** True when access ends within two days: shown in the warning colour. */
export function endsSoon(iso: string, now = Date.now()): boolean {
    return new Date(iso).getTime() - now < 2 * 86_400_000;
}

/** The organization part of "Avery Stone from Northwind Studio", if the label has one. */
export function senderOrganization(sender: { name: string; label: string }): string | null {
    const prefix = `${sender.name} from `;
    return sender.label.startsWith(prefix) ? sender.label.slice(prefix.length) : null;
}

/** Best-effort MIME type for files the browser doesn't label (e.g. .md on some systems). */
export function guessMimeType(file: { name: string; type: string }): string {
    if (file.type) return file.type;
    const byExtension: Record<string, string> = {
        md: 'text/markdown',
        markdown: 'text/markdown',
        txt: 'text/plain',
        csv: 'text/csv',
        json: 'application/json',
        pdf: 'application/pdf',
        zip: 'application/zip',
        '7z': 'application/x-7z-compressed',
        rar: 'application/x-rar-compressed',
    };
    return byExtension[getFileExtension(file.name)] ?? 'application/octet-stream';
}
