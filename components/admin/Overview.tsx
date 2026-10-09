'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, History, Plus, Send, Upload } from 'lucide-react';
import {
    Button,
    Callout,
    Card,
    CardHeader,
    EmptyState,
    PageHeader,
    Skeleton,
    StatCard,
    TBody,
    TD,
    TH,
    THead,
    TR,
    Table,
    buttonStyles,
    cn,
} from '@/components/ds';
import { ActivityRow, useExpandedRows } from '@/components/product/deliveries/ActivityRow';
import { DeliverySummary, DeliveryTableHead, DeliveryTableRow, DeliveryTableRowSkeleton } from '@/components/product/deliveries/DeliveryRow';
import type { ActivityItem, DeliveryListItem } from '@/components/product/deliveries/api';
import { plural } from '@/components/product/deliveries/format';
import type { LibraryFile } from '@/lib/files/library';
import FilePreviewDialog from './files/FilePreviewDialog';
import { FileTypeIcon } from './files/FileTypeIcon';
import { ApiError, requestJson } from './files/api';
import { formatFullDate, formatShortDate, formatSize, sendHref } from './files/format';

const ICON = { 'aria-hidden': true, strokeWidth: 1.75, className: 'h-4 w-4' } as const;
const RECENT_FILES = 5;
const RECENT_DELIVERIES = 5;
const RECENT_ACTIVITY = 6;

interface OverviewData {
    files: number;
    size: number;
    /** null when folders couldn't be loaded */
    folders: number | null;
    recent: LibraryFile[];
    /** null when deliveries couldn't be loaded */
    deliveries: { total: number; active: number | null; opens: number; complete: boolean; recent: DeliveryListItem[] } | null;
    /** null when activity couldn't be loaded */
    activity: ActivityItem[] | null;
}

/** Overview: what's here, the first-run guide, recent deliveries, recent activity and recent files. */
export default function Overview() {
    const router = useRouter();
    const [data, setData] = useState<OverviewData | null>(null);
    const [failed, setFailed] = useState<false | 'error' | 'signed-out'>(false);
    const [attempt, setAttempt] = useState(0);
    const [preview, setPreview] = useState<{ file: LibraryFile; key: number } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        // Deliveries, activity and folders are extras: if one fails, the rest of the page still shows
        const optional = <T,>(promise: Promise<T>) =>
            promise.catch((error) => {
                if (signal.aborted) throw error;
                return null;
            });
        Promise.all([
            requestJson<{ fileCount: number; totalSize: number }>('/api/files/stats', { signal }),
            requestJson<{ files: LibraryFile[] }>(`/api/files?all=true&limit=${RECENT_FILES}&sort=modified&order=desc`, { signal }),
            optional(requestJson<{ deliveries: DeliveryListItem[]; total: number }>('/api/deliveries?kind=send&limit=100', { signal })),
            optional(requestJson<{ items: ActivityItem[] }>(`/api/activity?limit=${RECENT_ACTIVITY}`, { signal })),
            optional(requestJson<{ folders: unknown[] }>('/api/folders?all=true', { signal })),
        ])
            .then(([stats, recent, deliveries, activity, folders]) => {
                setFailed(false);
                const complete = deliveries ? deliveries.deliveries.length >= deliveries.total : false;
                setData({
                    files: stats.fileCount,
                    size: stats.totalSize,
                    folders: folders ? folders.folders.length : null,
                    recent: recent.files,
                    deliveries: deliveries && {
                        total: deliveries.total,
                        complete,
                        active: complete ? deliveries.deliveries.filter((d) => d.status === 'active').length : null,
                        opens: deliveries.deliveries.reduce((sum, d) => sum + (d.opens || 0), 0),
                        recent: deliveries.deliveries.slice(0, RECENT_DELIVERIES),
                    },
                    activity: activity ? activity.items : null,
                });
            })
            .catch((error) => {
                if (!signal.aborted) setFailed(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'error');
            });
        return () => controller.abort();
    }, [attempt]);

    const loading = !data && !failed;
    const deliveries = data?.deliveries;
    const showGuide = data !== null && (data.files === 0 || deliveries?.total === 0);
    const retry = () => setAttempt((a) => a + 1);
    const detail = (text: string | undefined) => (loading ? <Skeleton className="my-0.5 h-3 w-20" /> : text);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Overview"
                description="Your files, what you've delivered and who opened it."
                actions={
                    <Button variant="primary" icon={<Plus {...ICON} />} onClick={() => router.push('/admin/deliveries/new')}>
                        New delivery
                    </Button>
                }
            />

            {failed === 'signed-out' && (
                <Callout tone="warning" action={<Button size="sm" onClick={() => router.push('/login')}>Sign in</Button>}>
                    You were signed out. Sign in again to see your overview.
                </Callout>
            )}
            {failed === 'error' && (
                <Callout tone="danger" action={<Button size="sm" onClick={retry}>Try again</Button>}>
                    We couldn&apos;t load your overview. Check your connection and try again.
                </Callout>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label="Files"
                    value={loading ? <ValueSkeleton /> : data ? data.files.toLocaleString('en-US') : '—'}
                    detail={detail(data && data.folders !== null ? (data.folders > 0 ? plural(data.folders, 'folder') : 'No folders yet') : undefined)}
                />
                <StatCard
                    label="Storage used"
                    value={loading ? <ValueSkeleton /> : data ? formatSize(data.size) : '—'}
                    detail={detail(data ? (data.files > 0 ? `Across ${plural(data.files, 'file')}` : 'No files yet') : undefined)}
                />
                <StatCard
                    label="Deliveries"
                    value={loading ? <ValueSkeleton /> : deliveries ? deliveries.total.toLocaleString('en-US') : '—'}
                    detail={detail(
                        deliveries ? (deliveries.total === 0 ? 'None sent yet' : deliveries.active !== null ? `${deliveries.active} active` : undefined) : undefined
                    )}
                />
                <StatCard
                    label="Opens"
                    value={loading ? <ValueSkeleton /> : deliveries ? `${deliveries.opens.toLocaleString('en-US')}${deliveries.complete ? '' : '+'}` : '—'}
                    detail={detail(deliveries ? (deliveries.total > 0 ? 'Across all deliveries' : 'None yet') : undefined)}
                />
            </div>

            {showGuide && data && <Guide files={data.files} deliveries={deliveries?.total ?? 0} opens={deliveries?.opens ?? 0} />}

            {!failed && (
                <>
                    <RecentDeliveries items={loading ? null : (deliveries?.recent ?? null)} failed={!loading && !deliveries} onRetry={retry} />
                    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                        <RecentActivity
                            items={loading ? null : (data?.activity ?? null)}
                            failed={!loading && !data?.activity}
                            hasDeliveries={Boolean(deliveries?.total)}
                            onRetry={retry}
                        />
                        <RecentFiles files={data?.recent ?? null} onPreview={(file) => setPreview({ file, key: Date.now() })} />
                    </div>
                </>
            )}

            {preview && <FilePreviewDialog key={preview.key} file={preview.file} onClose={() => setPreview(null)} />}
        </div>
    );
}

function ValueSkeleton() {
    return <Skeleton className="my-1 h-6 w-16" />;
}

/** "View all" in a card header: a link to the full page. */
function ViewAll({ href, what }: { href: string; what: string }) {
    return (
        <Link href={href} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            View all<span className="sr-only"> {what}</span>
            <ArrowRight {...ICON} />
        </Link>
    );
}

function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
    return (
        <div className="p-4 sm:p-5">
            <Callout tone="danger" action={<Button variant="link" size="sm" onClick={onRetry}>Try again</Button>}>
                We couldn&apos;t load your {what}. Check your connection and try again.
            </Callout>
        </div>
    );
}

function RecentDeliveries({ items, failed, onRetry }: { items: DeliveryListItem[] | null; failed: boolean; onRetry: () => void }) {
    const router = useRouter();
    const href = (item: DeliveryListItem) => `/admin/deliveries/${item.id}`;
    return (
        <Card flush className="overflow-hidden">
            <CardHeader title="Recent deliveries" actions={items?.length === 0 ? undefined : <ViewAll href="/admin/deliveries" what="deliveries" />} />
            {failed ? (
                <LoadFailed what="deliveries" onRetry={onRetry} />
            ) : items?.length === 0 ? (
                <EmptyState
                    icon={Send}
                    title="No deliveries yet"
                    description="Send files to the people who need them, and see who opened what."
                    action={
                        <Button icon={<Plus {...ICON} />} onClick={() => router.push('/admin/deliveries/new')}>
                            New delivery
                        </Button>
                    }
                />
            ) : (
                <>
                    {/* Wider screens: the Deliveries table */}
                    <div className="hidden md:block">
                        <Table aria-label="Recent deliveries">
                            <THead>
                                <DeliveryTableHead isRequest={false} withActions={false} />
                            </THead>
                            <TBody>
                                {items
                                    ? items.map((item) => <DeliveryTableRow key={item.id} item={item} href={href(item)} isRequest={false} />)
                                    : Array.from({ length: 3 }, (_, i) => <DeliveryTableRowSkeleton key={i} isRequest={false} withActions={false} />)}
                            </TBody>
                        </Table>
                    </div>
                    {/* Phones: the Deliveries cards, as rows of this card */}
                    <ul className="divide-y divide-gray-4 md:hidden" aria-label="Recent deliveries">
                        {items
                            ? items.map((item) => (
                                  <li key={item.id} className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-raised">
                                      <DeliverySummary item={item} href={href(item)} isRequest={false} />
                                  </li>
                              ))
                            : Array.from({ length: 3 }, (_, i) => (
                                  <li key={i} className="flex flex-col gap-2 px-4 py-3">
                                      <Skeleton className="h-4 w-48" />
                                      <Skeleton className="h-3 w-32" />
                                  </li>
                              ))}
                    </ul>
                </>
            )}
        </Card>
    );
}

function RecentActivity({
    items,
    failed,
    hasDeliveries,
    onRetry,
}: {
    items: ActivityItem[] | null;
    failed: boolean;
    hasDeliveries: boolean;
    onRetry: () => void;
}) {
    const router = useRouter();
    const rows = useExpandedRows();
    return (
        <Card flush className="overflow-hidden">
            <CardHeader title="Recent activity" actions={items?.length === 0 ? undefined : <ViewAll href="/admin/activity" what="activity" />} />
            {failed ? (
                <LoadFailed what="activity" onRetry={onRetry} />
            ) : items === null ? (
                <ul aria-label="Loading activity">
                    {Array.from({ length: RECENT_ACTIVITY }, (_, i) => (
                        <li key={i} className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-b-0 sm:px-5">
                            <Skeleton className="h-7 w-7 shrink-0" />
                            <Skeleton className={i % 2 ? 'h-3.5 w-1/2' : 'h-3.5 w-2/3'} />
                            <Skeleton className="ml-auto h-3 w-12 shrink-0" />
                        </li>
                    ))}
                </ul>
            ) : items.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="No activity yet"
                    description="When people open, download or are denied on your deliveries, it shows up here."
                    action={
                        hasDeliveries ? (
                            <Button icon={<ArrowRight {...ICON} />} onClick={() => router.push('/admin/deliveries')}>
                                View deliveries
                            </Button>
                        ) : (
                            <Button icon={<Plus {...ICON} />} onClick={() => router.push('/admin/deliveries/new')}>
                                New delivery
                            </Button>
                        )
                    }
                />
            ) : (
                <ul aria-label="Recent activity">
                    {items.map((item) => (
                        <ActivityRow key={item.id} item={item} time="relative" expanded={rows.expanded(item.id)} onToggle={() => rows.toggle(item.id)} />
                    ))}
                </ul>
            )}
        </Card>
    );
}

function RecentFiles({ files, onPreview }: { files: LibraryFile[] | null; onPreview: (file: LibraryFile) => void }) {
    const router = useRouter();
    return (
        <Card flush className="overflow-hidden">
            <CardHeader title="Recent files" actions={files?.length === 0 ? undefined : <ViewAll href="/admin/files" what="files" />} />
            {files?.length === 0 ? (
                <EmptyState
                    icon={Upload}
                    title="No files yet"
                    description="Upload the files you want to send. They stay private until you deliver them."
                    action={
                        <Button icon={<Upload {...ICON} />} onClick={() => router.push('/admin/files?upload=1')}>
                            Upload files
                        </Button>
                    }
                />
            ) : (
                <Table aria-label="Recent files">
                    <THead>
                        <tr>
                            <TH>Name</TH>
                            <TH numeric className="hidden sm:table-cell">
                                Size
                            </TH>
                            <TH className="hidden sm:table-cell">Modified</TH>
                            <TH className="w-px">
                                <span className="sr-only">Actions</span>
                            </TH>
                        </tr>
                    </THead>
                    <TBody>
                        {!files
                            ? ['w-48', 'w-36', 'w-56', 'w-40', 'w-32'].map((width) => (
                                  <TR key={width}>
                                      <TD className="w-full max-w-0">
                                          <div className="flex items-center gap-2.5">
                                              <Skeleton className="h-4 w-4 shrink-0" />
                                              <Skeleton className={cn('h-3 max-w-full', width)} />
                                          </div>
                                      </TD>
                                      <TD className="hidden sm:table-cell">
                                          <Skeleton className="ml-auto h-3 w-14" />
                                      </TD>
                                      <TD className="hidden sm:table-cell">
                                          <Skeleton className="h-3 w-12" />
                                      </TD>
                                      <TD>
                                          <Skeleton className="ml-auto h-7 w-[4.75rem]" />
                                      </TD>
                                  </TR>
                              ))
                            : files.map((file) => (
                                  <TR key={file.id} className="hover:bg-raised">
                                      <TD strong className="w-full max-w-0">
                                          <div className="flex min-w-0 items-center gap-2.5">
                                              <FileTypeIcon mimeType={file.mimeType} name={file.name} />
                                              <div className="min-w-0">
                                                  <button
                                                      type="button"
                                                      title={file.name}
                                                      onClick={() => onPreview(file)}
                                                      className="block max-w-full truncate rounded-sm text-left text-primary underline-offset-4 hover:text-strong hover:underline focus-ring"
                                                  >
                                                      {file.name}
                                                  </button>
                                                  <p className="truncate text-caption tabular-nums text-tertiary">
                                                      <span className="sm:hidden">
                                                          {formatSize(file.size)} · {formatShortDate(file.updatedAt)} ·{' '}
                                                      </span>
                                                      {file.folderName ? `In ${file.folderName}` : 'In All files'}
                                                  </p>
                                              </div>
                                          </div>
                                      </TD>
                                      <TD numeric className="hidden whitespace-nowrap sm:table-cell">
                                          {formatSize(file.size)}
                                      </TD>
                                      <TD className="hidden whitespace-nowrap sm:table-cell">
                                          <time dateTime={file.updatedAt} title={formatFullDate(file.updatedAt)}>
                                              {formatShortDate(file.updatedAt)}
                                          </time>
                                      </TD>
                                      <TD className="whitespace-nowrap">
                                          <div className="flex justify-end">
                                              <Button
                                                  size="sm"
                                                  icon={<Send {...ICON} />}
                                                  aria-label={`Send ${file.name}`}
                                                  onClick={() => router.push(sendHref([file.id]))}
                                              >
                                                  Send
                                              </Button>
                                          </div>
                                      </TD>
                                  </TR>
                              ))}
                    </TBody>
                </Table>
            )}
        </Card>
    );
}

function Guide({ files, deliveries, opens }: { files: number; deliveries: number; opens: number }) {
    const router = useRouter();
    const steps = [
        {
            title: 'Upload files',
            body: 'Add the files you want to send. They stay private until you deliver them.',
            done: files > 0,
            action: { label: 'Upload files', icon: <Upload {...ICON} />, href: '/admin/files?upload=1' },
        },
        {
            title: 'Create a delivery',
            body: 'Pick files, add the people who should get them, and send one link.',
            done: deliveries > 0,
            action: { label: 'New delivery', icon: <Plus {...ICON} />, href: '/admin/deliveries/new' },
        },
        {
            title: 'See who opened it',
            body: 'Every open, download and denied attempt shows up in Activity.',
            done: opens > 0,
            action: { label: 'View activity', icon: <ArrowRight {...ICON} />, href: '/admin/activity' },
        },
    ];
    // The first step that isn't done yet gets the button
    const next = steps.findIndex((step) => !step.done);
    const doneCount = steps.filter((step) => step.done).length;

    return (
        <Card flush>
            <CardHeader title="Get started" description={`${doneCount} of 3 done. Send your first delivery in three steps.`} />
            <ol className="grid divide-y divide-gray-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {steps.map((step, i) => (
                    <li key={step.title} className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
                        <span
                            className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-md border text-caption font-medium tabular-nums',
                                step.done ? 'border-success-border bg-success-bg text-success' : 'border-default bg-raised text-secondary'
                            )}
                        >
                            {step.done ? <Check aria-hidden strokeWidth={2} className="h-4 w-4" /> : i + 1}
                        </span>
                        <div>
                            <h3 className="text-body font-medium text-strong">
                                {step.title}
                                {step.done && <span className="sr-only"> (done)</span>}
                            </h3>
                            <p className="mt-1 text-body-sm text-secondary">{step.body}</p>
                        </div>
                        {i === next && (
                            <div className="mt-auto">
                                <Button size="sm" icon={step.action.icon} onClick={() => router.push(step.action.href)}>
                                    {step.action.label}
                                </Button>
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </Card>
    );
}
