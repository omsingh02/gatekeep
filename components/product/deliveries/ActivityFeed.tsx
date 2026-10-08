'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileDown, History, Mail, MailCheck, ShieldX, Upload, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { Button, Callout, Card, CardHeader, EmptyState, Skeleton, Tooltip, cn, useToast } from '@/components/ds';
import type { ActivityType } from '@/lib/types';
import { api, errorMessage, type ActivityItem } from './api';
import { activitySentence, dateTime, timeAgo } from './format';

const ICONS: Record<ActivityType, LucideIcon> = {
    opened: Eye,
    previewed: Eye,
    downloaded: Download,
    downloaded_all: Download,
    denied: ShieldX,
    code_sent: Mail,
    uploaded: Upload,
    access_given: UserPlus,
    access_removed: UserMinus,
    invite_sent: MailCheck,
};

export function ActivityRow({ item }: { item: ActivityItem }) {
    const Icon = ICONS[item.type] ?? History;
    const denied = item.type === 'denied';
    const details = [dateTime(item.createdAt), item.ip && item.ip !== 'unknown' ? `IP ${item.ip}` : null].filter(Boolean).join(' · ');
    return (
        <li className="flex items-start gap-3 px-4 py-3 sm:px-5" data-testid="activity-row">
            <span
                aria-hidden
                className={cn(
                    'mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                    denied ? 'border-danger-border bg-danger-bg text-danger' : 'border-subtle bg-raised text-secondary',
                )}
            >
                <Icon strokeWidth={1.75} className="h-3.5 w-3.5" />
            </span>
            <p className="min-w-0 flex-1 break-words pt-1 text-body-sm text-primary">{activitySentence(item)}</p>
            <Tooltip content={details} className="shrink-0 pt-1">
                <time
                    dateTime={item.createdAt}
                    tabIndex={0}
                    aria-label={`${timeAgo(item.createdAt)}, ${details}`}
                    className="whitespace-nowrap rounded-sm text-caption tabular-nums text-tertiary focus-ring"
                >
                    {timeAgo(item.createdAt)}
                </time>
            </Tooltip>
        </li>
    );
}

export interface ActivityFeedProps {
    deliveryId: string;
    /** Bump to reload after a change (e.g. access removed) */
    version?: number;
    title?: string;
}

/** Everything that happened on one delivery, newest first, with CSV export. */
export function ActivityFeed({ deliveryId, version = 0, title = 'Activity' }: ActivityFeedProps) {
    const toast = useToast();
    const [items, setItems] = useState<ActivityItem[] | null>(null);
    const [cursor, setCursor] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [reload, setReload] = useState(0);

    const fetchPage = useCallback(
        (after: string | null) =>
            api<{ items: ActivityItem[]; nextCursor: string | null }>(
                `/api/activity?delivery=${deliveryId}&limit=30${after ? `&cursor=${encodeURIComponent(after)}` : ''}`,
            ),
        [deliveryId],
    );

    useEffect(() => {
        let cancelled = false;
        fetchPage(null)
            .then((page) => {
                if (cancelled) return;
                setItems(page.items);
                setCursor(page.nextCursor);
                setError(null);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(errorMessage(err));
                setItems((current) => current ?? []);
            });
        return () => {
            cancelled = true;
        };
    }, [fetchPage, version, reload]);

    const more = async () => {
        setLoadingMore(true);
        try {
            const page = await fetchPage(cursor);
            setItems((list) => [...(list ?? []), ...page.items]);
            setCursor(page.nextCursor);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setLoadingMore(false);
        }
    };

    return (
        <Card flush>
            <CardHeader
                title={title}
                description="Opens, downloads and denied attempts. Hover a time for the date and IP address."
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<FileDown aria-hidden strokeWidth={1.75} className="h-4 w-4" />}
                        onClick={() => {
                            window.location.href = `/api/activity/export?delivery=${deliveryId}`;
                        }}
                    >
                        Export CSV
                    </Button>
                }
            />
            {error && (
                <div className="px-4 pt-4 sm:px-5">
                    <Callout tone="danger" action={<Button variant="link" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button>}>
                        {error}
                    </Callout>
                </div>
            )}
            {items === null ? (
                <ul aria-label="Loading activity" className="divide-y divide-gray-4">
                    {Array.from({ length: 5 }, (_, i) => (
                        <li key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                            <Skeleton className="h-7 w-7" />
                            <Skeleton className="h-3.5 w-64" />
                            <Skeleton className="ml-auto h-3 w-14" />
                        </li>
                    ))}
                </ul>
            ) : items.length === 0 ? (
                <EmptyState icon={History} title="Nothing yet" description="When someone opens the link, downloads a file or is denied, it shows up here." />
            ) : (
                <>
                    <ul className="divide-y divide-gray-4" aria-label="Activity">
                        {items.map((item) => (
                            <ActivityRow key={item.id} item={item} />
                        ))}
                    </ul>
                    {cursor && (
                        <div className="flex justify-center border-t border-subtle px-4 py-3">
                            <Button variant="ghost" size="sm" loading={loadingMore} onClick={more}>
                                Show older activity
                            </Button>
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}
