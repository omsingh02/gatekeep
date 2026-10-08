'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Plus, Send, Upload } from 'lucide-react';
import {
    Button,
    Callout,
    Card,
    CardHeader,
    PageHeader,
    Skeleton,
    StatCard,
    TBody,
    TD,
    TH,
    THead,
    TR,
    Table,
    cn,
} from '@/components/ds';
import type { FileMetadata } from '@/lib/types';
import FilePreviewDialog from './files/FilePreviewDialog';
import { FileTypeIcon } from './files/FileTypeIcon';
import { requestJson } from './files/api';
import { formatFullDate, formatShortDate, formatSize, sendHref } from './files/format';

const ICON = { 'aria-hidden': true, strokeWidth: 1.75, className: 'h-4 w-4' } as const;
const RECENT = 5;

interface OverviewData {
    files: number;
    size: number;
    recent: FileMetadata[];
    /** null when deliveries couldn't be loaded */
    deliveries: { total: number; active: number | null; opens: number; complete: boolean } | null;
}

/** Overview: what's here, the first-run guide, and the most recent files. */
export default function Overview() {
    const router = useRouter();
    const [data, setData] = useState<OverviewData | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [preview, setPreview] = useState<{ file: FileMetadata; key: number } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        Promise.all([
            requestJson<{ totalFiles: number; totalSize: number }>('/api/files/stats', { signal }),
            requestJson<{ files: FileMetadata[] }>(`/api/files?showAll=true&limit=${RECENT}&sort=modified&order=desc`, { signal }),
            requestJson<{ deliveries: { status: string; opens: number }[]; total: number }>('/api/deliveries?kind=send&limit=100', { signal }).catch(
                (error) => {
                    if (signal.aborted) throw error;
                    return null;
                }
            ),
        ])
            .then(([stats, recent, deliveries]) => {
                setFailed(false);
                setData({
                    files: stats.totalFiles,
                    size: stats.totalSize,
                    recent: recent.files,
                    deliveries: deliveries && {
                        total: deliveries.total,
                        complete: deliveries.deliveries.length >= deliveries.total,
                        active: deliveries.deliveries.length >= deliveries.total ? deliveries.deliveries.filter((d) => d.status === 'active').length : null,
                        opens: deliveries.deliveries.reduce((sum, d) => sum + (d.opens || 0), 0),
                    },
                });
            })
            .catch(() => {
                if (!signal.aborted) setFailed(true);
            });
        return () => controller.abort();
    }, [attempt]);

    const loading = !data && !failed;
    const deliveries = data?.deliveries;
    const showGuide = data !== null && (data.files === 0 || deliveries?.total === 0);

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

            {failed && (
                <Callout tone="danger" action={<Button size="sm" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>}>
                    We couldn&apos;t load your overview. Check your connection and try again.
                </Callout>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Files" value={loading ? <ValueSkeleton /> : data ? data.files.toLocaleString('en-US') : '—'} />
                <StatCard label="Storage used" value={loading ? <ValueSkeleton /> : data ? formatSize(data.size) : '—'} />
                <StatCard
                    label="Deliveries"
                    value={loading ? <ValueSkeleton /> : deliveries ? deliveries.total.toLocaleString('en-US') : '—'}
                    detail={deliveries && deliveries.active !== null && deliveries.total > 0 ? `${deliveries.active} active` : undefined}
                />
                <StatCard
                    label="Opens"
                    value={loading ? <ValueSkeleton /> : deliveries ? `${deliveries.opens.toLocaleString('en-US')}${deliveries.complete ? '' : '+'}` : '—'}
                    detail={deliveries && deliveries.total > 0 ? 'Across all deliveries' : undefined}
                />
            </div>

            {showGuide && data && <Guide files={data.files} deliveries={deliveries?.total ?? 0} opens={deliveries?.opens ?? 0} />}

            {(loading || (data && data.files > 0)) && (
                <Card flush className="overflow-hidden">
                    <CardHeader
                        title="Recent files"
                        description="The files you added or changed most recently."
                        actions={
                            <Button variant="ghost" size="sm" iconRight={<ArrowRight {...ICON} />} onClick={() => router.push('/admin/files')}>
                                View all
                            </Button>
                        }
                    />
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
                            {!data
                                ? ['w-48', 'w-36', 'w-56', 'w-40', 'w-32'].map((width) => (
                                      <TR key={width}>
                                          <TD className="w-full">
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
                                              <Skeleton className="ml-auto h-7 w-[4.25rem]" />
                                          </TD>
                                      </TR>
                                  ))
                                : data.recent.map((file) => (
                                      <TR key={file.id} className="hover:bg-raised">
                                          <TD strong className="w-full max-w-0">
                                              <div className="flex min-w-0 items-center gap-2.5">
                                                  <FileTypeIcon mimeType={file.mimeType} name={file.originalFilename} />
                                                  <div className="min-w-0">
                                                      <button
                                                          type="button"
                                                          title={file.originalFilename}
                                                          onClick={() => setPreview({ file, key: Date.now() })}
                                                          className="block max-w-full truncate rounded-sm text-left text-primary underline-offset-4 hover:text-strong hover:underline focus-ring"
                                                      >
                                                          {file.originalFilename}
                                                      </button>
                                                      <p className="truncate text-caption tabular-nums text-tertiary">
                                                          <span className="sm:hidden">
                                                              {formatSize(file.fileSize)} · {formatShortDate(file.updatedAt)} ·{' '}
                                                          </span>
                                                          {file.folderName ? `In ${file.folderName}` : 'In All files'}
                                                      </p>
                                                  </div>
                                              </div>
                                          </TD>
                                          <TD numeric className="hidden whitespace-nowrap sm:table-cell">
                                              {formatSize(file.fileSize)}
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
                                                      aria-label={`Send ${file.originalFilename}`}
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
                </Card>
            )}

            {preview && <FilePreviewDialog key={preview.key} file={preview.file} onClose={() => setPreview(null)} />}
        </div>
    );
}

function ValueSkeleton() {
    return <Skeleton className="my-1 h-6 w-16" />;
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
