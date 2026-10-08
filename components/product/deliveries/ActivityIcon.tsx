import { Ban, Download, Eye, FolderDown, History, KeyRound, LogIn, Send, Upload, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { cn } from '@/components/ds';
import type { ActivityType } from '@/lib/types';

/** One icon per kind of event, the same on the Activity page and a delivery's Activity tab. */
const ICONS: Record<ActivityType, LucideIcon> = {
    opened: LogIn,
    previewed: Eye,
    downloaded: Download,
    downloaded_all: FolderDown,
    denied: Ban,
    code_sent: KeyRound,
    invite_sent: Send,
    uploaded: Upload,
    access_given: UserPlus,
    access_removed: UserMinus,
};

/** The event's icon in a small tile; denied attempts get the danger tint. */
export function ActivityIcon({ type, label }: { type: ActivityType; label?: string }) {
    const Icon = ICONS[type] ?? History;
    return (
        <span
            className={cn(
                'mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                type === 'denied' ? 'border-danger-border bg-danger-bg text-danger' : 'border-subtle bg-raised text-secondary',
            )}
        >
            <Icon aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />
            {label && <span className="sr-only">{label}</span>}
        </span>
    );
}
