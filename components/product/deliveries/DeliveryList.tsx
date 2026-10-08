'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Inbox, Link2, Plus, Search, Send, Trash2, X } from 'lucide-react';
import {
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
    TBody,
    THead,
    Table,
    TableEmpty,
    Toolbar,
    useToast,
} from '@/components/ds';
import { useDebouncedValue } from '@/lib/utils/hooks';
import { api, errorMessage, type DeliveryKind, type DeliveryListItem } from './api';
import { DeliverySummary, DeliveryTableHead, DeliveryTableRow, DeliveryTableRowSkeleton } from './DeliveryRow';
import { useCopy } from './SentPanel';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
const PAGE = 50;

type StatusFilter = 'all' | 'active' | 'ended';

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
                                <DeliveryTableHead isRequest={isRequest} />
                            </THead>
                            <TBody>
                                {loading ? (
                                    Array.from({ length: 6 }, (_, i) => <DeliveryTableRowSkeleton key={i} isRequest={isRequest} />)
                                ) : visible.length === 0 ? (
                                    <TableEmpty colSpan={isRequest ? 6 : 7}>
                                        {q ? `No ${noun === 'request' ? 'requests' : 'deliveries'} match “${q}”.` : `No ${status} ${noun === 'request' ? 'requests' : 'deliveries'}.`}
                                    </TableEmpty>
                                ) : (
                                    visible.map((item) => (
                                        <DeliveryTableRow key={item.id} item={item} href={`${base}/${item.id}`} isRequest={isRequest} actions={menu(item)} />
                                    ))
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
                              : visible.map((item) => (
                                    <li key={item.id}>
                                        <Card className="relative flex items-start gap-3 transition-colors hover:border-strong">
                                            <DeliverySummary item={item} href={`${base}/${item.id}`} isRequest={isRequest} actions={menu(item)} />
                                        </Card>
                                    </li>
                                ))}
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
