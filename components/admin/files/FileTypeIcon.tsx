import {
    File,
    FileArchive,
    FileAudio,
    FileCode,
    FileImage,
    FileSliders,
    FileSpreadsheet,
    FileText,
    FileVideo,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/components/ds';
import { getFileExtension } from '@/lib/utils/fileTypes';

export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'code' | 'text' | 'archive' | 'other';

const ARCHIVES = new Set(['zip', 'tar', 'gz', 'rar', '7z']);
const SPREADSHEETS = new Set(['xls', 'xlsx', 'csv']);
const PRESENTATIONS = new Set(['ppt', 'pptx']);
const DOCUMENTS = new Set(['doc', 'docx']);
const CODE = new Set(['json', 'xml', 'html', 'htm', 'css']);
const TEXT = new Set(['txt', 'md', 'markdown']);

/** What kind of file this is, from its MIME type with the extension as a fallback. */
export function fileKind(mimeType: string | null | undefined, name: string): FileKind {
    const mime = mimeType ?? '';
    const ext = getFileExtension(name);
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (ARCHIVES.has(ext) || /zip|tar|gzip|rar|7z/.test(mime)) return 'archive';
    if (SPREADSHEETS.has(ext) || mime.includes('spreadsheet') || mime.includes('ms-excel')) return 'spreadsheet';
    if (PRESENTATIONS.has(ext) || mime.includes('presentation') || mime.includes('ms-powerpoint')) return 'presentation';
    if (DOCUMENTS.has(ext) || mime.includes('wordprocessing') || mime.includes('msword')) return 'document';
    if (CODE.has(ext)) return 'code';
    if (TEXT.has(ext) || mime.startsWith('text/')) return 'text';
    return 'other';
}

const PREVIEWABLE = new Set<FileKind>(['image', 'video', 'audio', 'pdf', 'text', 'code']);

/** Whether the dashboard can show this file in FilePreviewDialog (otherwise it's download only). */
export function isPreviewable(mimeType: string | null | undefined, name: string): boolean {
    return PREVIEWABLE.has(fileKind(mimeType, name));
}

const ICONS: Record<FileKind, LucideIcon> = {
    image: FileImage,
    video: FileVideo,
    audio: FileAudio,
    pdf: FileText,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    presentation: FileSliders,
    code: FileCode,
    text: FileText,
    archive: FileArchive,
    other: File,
};

/** Short type label for badges and metadata ("PDF", "Image", "Spreadsheet"). */
export function fileKindLabel(kind: FileKind, name: string): string {
    const ext = getFileExtension(name).toUpperCase();
    switch (kind) {
        case 'pdf':
            return 'PDF';
        case 'image':
            return ext ? `${ext} image` : 'Image';
        case 'video':
            return ext ? `${ext} video` : 'Video';
        case 'audio':
            return ext ? `${ext} audio` : 'Audio';
        case 'archive':
            return ext ? `${ext} archive` : 'Archive';
        default:
            return ext || 'File';
    }
}

/**
 * Monochrome lucide icon for a file. Never coloured per type.
 * `className` replaces the default size and colour (16px, secondary).
 */
export function FileTypeIcon({ mimeType, name, className }: { mimeType?: string | null; name: string; className?: string }) {
    const Icon = ICONS[fileKind(mimeType, name)];
    return <Icon aria-hidden strokeWidth={1.75} className={cn('shrink-0', className ?? 'h-4 w-4 text-secondary')} />;
}
