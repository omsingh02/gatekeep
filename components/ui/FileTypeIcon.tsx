import { File, FileText, FileType2, Film, Image as ImageIcon, Music, type LucideIcon } from 'lucide-react';
import type { FileCategory } from '@/lib/types';

const ICONS: Record<FileCategory, { icon: LucideIcon; color: string }> = {
    image: { icon: ImageIcon, color: '#22d3ee' },
    video: { icon: Film, color: '#a78bfa' },
    audio: { icon: Music, color: '#f472b6' },
    pdf: { icon: FileText, color: '#f87171' },
    document: { icon: FileType2, color: '#818cf8' },
    other: { icon: File, color: '#9ca3af' },
};

/** Line icon for a file category, replacing the old emoji icons. */
export function FileTypeIcon({ category, size = 18 }: { category: FileCategory; size?: number }) {
    const { icon: Icon, color } = ICONS[category] ?? ICONS.other;
    return <Icon aria-hidden width={size} height={size} style={{ color, flexShrink: 0 }} />;
}
