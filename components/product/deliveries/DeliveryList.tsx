'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Inbox, Link2, Plus, Search, Send, Trash2, X } from 'lucide-react';
import {
    Avatar,
    Button,
    Callout,
    Card,
    ConfirmDialog,
    EmptyState,
    IconButton,
    Input,
    Menu,
    PageHeader,
    SegmentedControl,
    Skeleton,
    StatusPill,
    TBody,
    TD,
    TH,
    THead,
    TR,
    Table,
    TableEmpty,
    Toolbar,
    useToast,
    type BadgeTone,
} from '@/components/ds';
import { useDebouncedValue } from '@/lib/utils/hooks';
import { api, errorMessage, type DeliveryKind, type DeliveryListItem } from './api';
import { ANYONE_LABEL, dateTime, plural, timeAgo } from './format';
import { useCopy } from './SentPanel';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
const PAGE = 50;

type StatusFilter = 'all' | 'active' | 'ended';

const STATUS: Record<DeliveryListItem['status'], { tone: BadgeTone; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    ended: { tone: 'danger', label: 'Ended' },
    no_recipients: { tone: 'neutral', label: 'No people' },
};

function People({ item }: { item: DeliveryListItem }) {
    if (item.recipientCount === 0) return <span className="text-tertiary">No one yet</span>;
    const preview = item.recipientPreview ?? [];
    const first = preview[0];
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                {preview.map((name, i) => (
                    <Avatar key={i} name={name === ANYONE_LABEL ? '*' : name} size="sm" className="ring-2 ring-gray-2" />
                ))}
            </span>
            <span className="min-w-0 truncate text-body-sm text-secondary">
                {item.recipientCount === 1 && first ? first : plural(item.recipientCount, 'person', 'people')}
            </span>
        </span>
    );
}

function lastActivity(item: DeliveryListItem) {
    return item.lastOpenedAt ? { text: `Opened ${timeAgo(item.lastOpenedAt).toLowerCase()}`, at: item.lastOpenedAt } : { text: `Created ${timeAgo(item.createdAt).toLowerCase()}`, at: item.createdAt };
}

function capitalize(text: string) {
    return text[0].toUpperCase() + text.slice(1);
}

/** Deliveries (or requests): search, filter by status, open one, copy its link or delete it. */
export function DeliveryList({ kind }: { kind: DeliveryKind }) {
    const router = useRouter();
    const toast = useToast();
    const copy = useCopy();
    const isRequest = kind === 'request';
    const base = isRequest ? '/admin/requests' : '/admin/deliveries';
    const noun = isRequest ? 'request' : 'delivery';

    const [query, setQuery] = useState('');
    const q = useDebouncedValue(query.trim(), 250);
    const [status, setStatus] = useState<StatusFilter>('all');
    const [items, setItems] = useState<DeliveryListItem[] | null>(null);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [deleting, setDeleting] = useState<DeliveryListItem | null>(null);
    const [reload, setReload] = useState(0);

    const load = useCallback(
        async (offset: number) => {
            const params = new URLSearchParams({ kind, limit: String(PAGE), offset: String(offset) });
            if (q) params.set('q', q);
            return api<{ deliveries: DeliveryListItem[]; total: number }>(`/api/deliveries?${params}`);
        },
        [kind, q],
    );

    useEffect(() => {
        let cancelled = false;
        load(0)
            .then((res) => {
                if (cancelled) return;
                setItems(res.deliveries);
                setTotal(res.total);
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
    }, [load, reload]);

    const more = async () => {
        if (!items) return;
        setLoadingMore(true);
        try {
            const res = await load(items.length);
            setItems([...items, ...res.deliveries]);
            setTotal(res.total);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setLoadingMore(false);
        }
    };

    const remove = async () => {
        if (!deleting) return;
        try {
            await api(`/api/deliveries/${deleting.id}`, { method: 'DELETE' });
            setItems((list) => list?.filter((d) => d.id !== deleting.id) ?? null);
            setTotal((t) => t - 1);
            toast.success(`Deleted ${deleting.title}`);
            setDeleting(null);
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };

    const visible = (items ?? []).filter((d) => status === 'all' || d.status === status);
    const loading = items === null;
    const empty = !loading && !error && items.length === 0 && !q;
    const newButton = (
        <Button variant="primary" icon={<Plus {...ICON} />} onClick={() => router.push(`${base}/new`)}>
            {isRequest ? 'New request' : 'New delivery'}
        </Button>
    );

    const menu = (item: DeliveryListItem) => (
        <Menu
            label={`More actions for ${item.title}`}
            items={[
                { label: 'Copy link', icon: <Link2 {...ICON} />, onSelect: () => copy(item.link, 'Link copied') },
                { label: 'Open', icon: <ExternalLink {...ICON} />, onSelect: () => window.open(item.link, '_blank', 'noopener,noreferrer') },
                { type: 'separator' },
                { label: isRequest ? 'Delete request' : 'Delete delivery', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setDeleting(item) },
            ]}
        />
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={isRequest ? 'Requests' : 'Deliveries'}
                description={isRequest ? 'Links that let people upload files to you.' : "Files you've sent and who opened them."}
                actions={!empty && newButton}
            />

            {empty ? (
                <Card>
                    <EmptyState
                        icon={isRequest ? Inbox : Send}
                        title={isRequest ? 'No requests yet' : 'No deliveries yet'}
                        description={
                            isRequest
                                ? 'Ask a client for files. They upload through a link only they can open, straight into a folder you choose.'
                                : 'Send files to the people who need them, and see who opened what.'
                        }
                        action={newButton}
                    />
                </Card>
            ) : (
                <>
                    <Toolbar>
                        <div className="min-w-0 flex-1 basis-60 sm:max-w-80">
                            <Input
                                aria-label={isRequest ? 'Search requests' : 'Search deliveries'}
                                placeholder="Search by title"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                leading={<Search {...ICON} />}
                                trailing={query ? <IconButton label="Clear search" size="sm" icon={<X {...ICON} />} onClick={() => setQuery('')} /> : undefined}
                            />
                        </div>
                        <SegmentedControl
                            label="Status"
                            value={status}
                            onChange={setStatus}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'active', label: 'Active' },
                                { value: 'ended', label: 'Ended' },
                            ]}
                        />
                    </Toolbar>

                    {error && (
                        <Callout tone="danger" action={<Button variant="link" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button>}>
                            {error}
                        </Callout>
                    )}

                    {/* Desktop and tablet: table */}
                    <Card flush className="hidden overflow-hidden md:block">
                        <Table aria-label={isRequest ? 'Requests' : 'Deliveries'}>
                            <THead>
                                <tr>
                                    <TH>Title</TH>
                                    {!isRequest && <TH numeric>Files</TH>}
                                    <TH>{isRequest ? 'Who can upload' : 'Recipients'}</TH>
                                    <TH numeric>Opens</TH>
                                    <TH>Last activity</TH>
                                    <TH>Status</TH>
                                    <TH className="w-12">
                                        <span className="sr-only">Actions</span>
                                    </TH>
                                </tr>
                            </THead>
                            <TBody>
                                {loading ? (
                                    Array.from({ length: 6 }, (_, i) => (
                                        <TR key={i}>
                                            <TD>
                                                <Skeleton className="h-3.5 w-48" />
                                            </TD>
                                            {!isRequest && (
                                                <TD numeric>
                                                    <Skeleton className="ml-auto h-3.5 w-6" />
                                                </TD>
                                            )}
                                            <TD>
                                                <Skeleton className="h-6 w-32" />
                                            </TD>
                                            <TD numeric>
                                                <Skeleton className="ml-auto h-3.5 w-6" />
                                            </TD>
                                            <TD>
                                                <Skeleton className="h-3.5 w-24" />
                                            </TD>
                                            <TD>
                                                <Skeleton className="h-5 w-16" />
                                            </TD>
                                            <TD />
                                        </TR>
                                    ))
                                ) : visible.length === 0 ? (
                                    <TableEmpty colSpan={isRequest ? 6 : 7}>
                                        {q ? `No ${noun === 'request' ? 'requests' : 'deliveries'} match “${q}”.` : `No ${status} ${noun === 'request' ? 'requests' : 'deliveries'}.`}
                                    </TableEmpty>
                                ) : (
                                    visible.map((item) => {
                                        const last = lastActivity(item);
                                        return (
                                            <TR key={item.id} interactive onClick={() => router.push(`${base}/${item.id}`)} data-testid="delivery-row">
                                                <TD strong className="max-w-[360px]">
                                                    <Link
                                                        href={`${base}/${item.id}`}
                                                        onClick={(event) => event.stopPropagation()}
                                                        className="block truncate rounded-sm font-medium text-strong hover:underline focus-ring"
                                                    >
                                                        {item.title}
                                                    </Link>
                                                </TD>
                                                {!isRequest && <TD numeric>{item.fileCount}</TD>}
                                                <TD>
                                                    <People item={item} />
                                                </TD>
                                                <TD numeric>{item.opens}</TD>
                                                <TD>
                                                    <span title={dateTime(last.at)} className="whitespace-nowrap">
                                                        {capitalize(last.text)}
                                                    </span>
                                                </TD>
                                                <TD>
                                                    <StatusPill tone={STATUS[item.status].tone}>{STATUS[item.status].label}</StatusPill>
                                                </TD>
                                                <TD onClick={(event) => event.stopPropagation()} className="text-right">
                                                    {menu(item)}
                                                </TD>
                                            </TR>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </Card>

                    {/* Phones: cards */}
                    <ul className="flex flex-col gap-2 md:hidden" aria-label={isRequest ? 'Requests' : 'Deliveries'}>
                        {loading
                            ? Array.from({ length: 4 }, (_, i) => (
                                  <li key={i}>
                                      <Card className="flex flex-col gap-2">
                                          <Skeleton className="h-4 w-48" />
                                          <Skeleton className="h-3 w-32" />
                                      </Card>
                                  </li>
                              ))
                            : visible.length === 0
                              ? (
                                    <li>
                                        <Card className="py-8 text-center text-body-sm text-secondary">
                                            {q ? `No ${isRequest ? 'requests' : 'deliveries'} match “${q}”.` : `No ${status} ${isRequest ? 'requests' : 'deliveries'}.`}
                                        </Card>
                                    </li>
                                )
                              : visible.map((item) => {
                                    const last = lastActivity(item);
                                    return (
                                        <li key={item.id}>
                                            <Card className="relative flex items-start gap-3 transition-colors hover:border-strong">
                                                <div className="min-w-0 flex-1">
                                                    <Link href={`${base}/${item.id}`} className="block truncate rounded-sm text-body font-medium text-strong focus-ring after:absolute after:inset-0">
                                                        {item.title}
                                                    </Link>
                                                    <p className="mt-1 text-caption text-secondary">
                                                        {[
                                                            !isRequest ? plural(item.fileCount, 'file') : null,
                                                            plural(item.recipientCount, 'person', 'people'),
                                                            plural(item.opens, 'open'),
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </p>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <StatusPill tone={STATUS[item.status].tone}>{STATUS[item.status].label}</StatusPill>
                                                        <span className="text-caption text-tertiary">{capitalize(last.text)}</span>
                                                    </div>
                                                </div>
                                                <div className="relative z-10 -mr-1.5 -mt-1">{menu(item)}</div>
                                            </Card>
                                        </li>
                                    );
                                })}
                    </ul>

                    {items && items.length < total && (
                        <div className="flex justify-center">
                            <Button variant="secondary" loading={loadingMore} onClick={more}>
                                Show more
                            </Button>
                        </div>
                    )}
                </>
            )}

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                onConfirm={remove}
                destructive
                title={`Delete ${deleting?.title ?? ''}?`}
                confirmLabel={isRequest ? 'Delete request' : 'Delete delivery'}
            >
                {isRequest
                    ? "The link stops working for everyone right away, and nobody can upload through it. Files already received stay in Files, and the activity stays on record."
                    : "The link stops working for everyone right away, including anyone who has it open. The files stay in Files, and the activity stays on record."}
            </ConfirmDialog>
        </div>
    );
}
