import { File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder } from 'lucide-react';
import { cn } from '@/components/ds';

const PROPS = { strokeWidth: 1.75, className: 'h-4 w-4' } as const;

function renderIcon(mimeType: string, folder?: boolean) {
    if (folder) return <Folder {...PROPS} />;
    if (mimeType.startsWith('image/')) return <FileImage {...PROPS} />;
    if (mimeType.startsWith('video/')) return <FileVideo {...PROPS} />;
    if (mimeType.startsWith('audio/')) return <FileAudio {...PROPS} />;
    if (/zip|tar|gzip|rar|7z/.test(mimeType)) return <FileArchive {...PROPS} />;
    if (/spreadsheet|excel|csv/.test(mimeType)) return <FileSpreadsheet {...PROPS} />;
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/') || /word|document|presentation/.test(mimeType)) return <FileText {...PROPS} />;
    return <File {...PROPS} />;
}

/** Monochrome file-type icon in a small neutral tile (docs/DESIGN.md: no per-type colours). */
export function FileIcon({ mimeType, folder, className }: { mimeType?: string; folder?: boolean; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-subtle bg-raised text-secondary', className)}
        >
            {renderIcon(mimeType ?? '', folder)}
        </span>
    );
}

/** "PDF", "PNG", "Folder": the short type label next to a file. */
export function fileTypeLabel(name: string, mimeType: string): string {
    const dot = name.lastIndexOf('.');
    if (dot > 0 && name.length - dot <= 6) return name.slice(dot + 1).toUpperCase();
    return mimeType.split('/')[1]?.toUpperCase() ?? 'File';
}
