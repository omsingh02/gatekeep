'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, History, SearchX, X } from 'lucide-react';
import {
    Button,
    Callout,
    Card,
    EmptyState,
    Field,
    Input,
    PageHeader,
    SegmentedControl,
    Select,
    Skeleton,
    StatCard,
    Toolbar,
    useToast,
} from '@/components/ds';
import type { ActivityItem, ActivitySummary } from '@/lib/deliveries/activity-query';
import type { ActivityType } from '@/lib/types';
import { ActivityRow, useExpandedRows } from '@/components/product/deliveries/ActivityRow';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
const DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;

type RangeKey = 'today' | '7d' | '30d' | 'all' | 'custom';

const RANGES: { value: RangeKey; label: string; detail: string }[] = [
    { value: 'today', label: 'Today', detail: 'Today' },
    { value: '7d', label: '7 days', detail: 'Last 7 days' },
    { value: '30d', label: '30 days', detail: 'Last 30 days' },
    { value: 'all', label: 'All time', detail: 'All time' },
    { value: 'custom', label: 'Custom', detail: 'Custom dates' },
];

const EVENTS: { value: string; label: string; types: ActivityType[] }[] = [
    { value: 'opened', label: 'Opened', types: ['opened'] },
    { value: 'previewed', label: 'Previewed', types: ['previewed'] },
    { value: 'downloaded', label: 'Downloaded', types: ['downloaded', 'downloaded_all'] },
    { value: 'denied', label: 'Denied', types: ['denied'] },
    { value: 'code_sent', label: 'Code sent', types: ['code_sent'] },
    { value: 'invite_sent', label: 'Invite sent', types: ['invite_sent'] },
    { value: 'uploaded', label: 'Uploaded', types: ['uploaded'] },
    { value: 'access_given', label: 'Access given', types: ['access_given'] },
    { value: 'access_removed', label: 'Access removed', types: ['access_removed'] },
];

interface Filters {
    delivery: string;
    event: string;
    range: RangeKey;
    from: string;
    to: string;
    person: string;
}

interface DeliveryOption {
    id: string;
    title: string;
    kind: 'send' | 'request';
}

function readFilters(params: URLSearchParams): Filters {
    const range = params.get('range') as RangeKey | null;
    return {
        delivery: params.get('delivery') ?? '',
        event: params.get('event') ?? '',
        range: range && RANGES.some((r) => r.value === range) ? range : '30d',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
        person: params.get('person') ?? '',
    };
}

function localDay(value: string, endOfDay = false): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (endOfDay) d.setHours(23, 59, 59, 999);
    return d;
}

/** The API query for these filters. Dates are computed now, in the browser's time zone. */
function apiQuery(filters: Filters, { withType }: { withType: boolean }): URLSearchParams {
    const q = new URLSearchParams();
    if (filters.delivery) q.set('delivery', filters.delivery);
    if (filters.person) q.set('recipient', filters.person);
    if (withType && filters.event) {
        const event = EVENTS.find((e) => e.value === filters.event);
        if (event) q.set('type', event.types.join(','));
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from: Date | null = null;
    let to: Date | null = null;
    if (filters.range === 'today') from = today;
    if (filters.range === '7d') from = new Date(today.getTime() - 6 * DAY);
    if (filters.range === '30d') from = new Date(today.getTime() - 29 * DAY);
    if (filters.range === 'custom') {
        from = localDay(filters.from);
        to = localDay(filters.to, true);
    }
    if (from) q.set('from', from.toISOString());
    if (to) q.set('to', to.toISOString());
    return q;
}

const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const dayFormatWithYear = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

function dayKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date, now: number) {
    const today = new Date(now);
    const yesterday = new Date(now - DAY);
    const date = (d.getFullYear() === today.getFullYear() ? dayFormat : dayFormatWithYear).format(d);
    if (dayKey(d) === dayKey(today)) return `Today · ${date.split(', ').slice(1).join(', ')}`;
    if (dayKey(d) === dayKey(yesterday)) return `Yesterday · ${date.split(', ').slice(1).join(', ')}`;
    return date;
}

const number = new Intl.NumberFormat('en-US');

interface FeedState {
    key: string;
    items: ActivityItem[];
    nextCursor: string | null;
    error?: string;
}

async function readError(res: Response) {
    const body = await res.json().catch(() => null);
    return (body && typeof body.error === 'string' && body.error) || 'Something went wrong on our side. Try again in a moment.';
}

export default function ActivityView() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const toast = useToast();
    const filters = useMemo(() => readFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
    const filterKey = JSON.stringify(filters);

    const [now] = useState(() => Date.now());
    const [feed, setFeed] = useState<FeedState | null>(null);
    const [summary, setSummary] = useState<{ key: string; data: ActivitySummary | null } | null>(null);
    const [deliveries, setDeliveries] = useState<DeliveryOption[] | null>(null);
    const rows = useExpandedRows();
    const [loadingMore, setLoadingMore] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [exporting, setExporting] = useState(false);

    const setFilters = useCallback(
        (patch: Partial<Filters>) => {
            const next = { ...filters, ...patch };
            const q = new URLSearchParams();
            if (next.delivery) q.set('delivery', next.delivery);
            if (next.person) q.set('person', next.person);
            if (next.event) q.set('event', next.event);
            if (next.range !== '30d') q.set('range', next.range);
            if (next.range === 'custom') {
                if (next.from) q.set('from', next.from);
                if (next.to) q.set('to', next.to);
            }
            const qs = q.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        },
        [filters, pathname, router]
    );

    // The feed and the period totals reload whenever the filters change
    useEffect(() => {
        let cancelled = false;
        const parsed = JSON.parse(filterKey) as Filters;
        const feedQuery = apiQuery(parsed, { withType: true });
        feedQuery.set('limit', String(PAGE_SIZE));
        fetch(`/api/activity?${feedQuery}`, { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error(await readError(res));
                return res.json() as Promise<{ items: ActivityItem[]; nextCursor: string | null }>;
            })
            .then((data) => !cancelled && setFeed({ key: filterKey, items: data.items, nextCursor: data.nextCursor }))
            .catch((err: Error) => !cancelled && setFeed({ key: filterKey, items: [], nextCursor: null, error: err.message }));

        fetch(`/api/activity/summary?${apiQuery(parsed, { withType: false })}`, { cache: 'no-store' })
            .then((res) => (res.ok ? (res.json() as Promise<ActivitySummary>) : null))
            .then((data) => !cancelled && setSummary({ key: filterKey, data }))
            .catch(() => !cancelled && setSummary({ key: filterKey, data: null }));
        return () => {
            cancelled = true;
        };
    }, [filterKey, reloadToken]);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/deliveries?limit=100', { cache: 'no-store' })
            .then((res) => (res.ok ? res.json() : { deliveries: [] }))
            .then((data: { deliveries: DeliveryOption[] }) => !cancelled && setDeliveries(data.deliveries ?? []))
            .catch(() => !cancelled && setDeliveries([]));
        return () => {
            cancelled = true;
        };
    }, []);

    const loading = !feed || feed.key !== filterKey;
    const summaryData = summary && summary.key === filterKey ? summary.data : undefined;

    const loadMore = async () => {
        if (!feed?.nextCursor) return;
        setLoadingMore(true);
        try {
            const q = apiQuery(filters, { withType: true });
            q.set('limit', String(PAGE_SIZE));
            q.set('cursor', feed.nextCursor);
            const res = await fetch(`/api/activity?${q}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(await readError(res));
            const data = (await res.json()) as { items: ActivityItem[]; nextCursor: string | null };
            setFeed((current) =>
                current && current.key === filterKey
                    ? { ...current, items: [...current.items, ...data.items], nextCursor: data.nextCursor }
                    : current
            );
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "We couldn't load more activity. Try again.");
        } finally {
            setLoadingMore(false);
        }
    };

    const exportCsv = () => {
        setExporting(true);
        // The response is an attachment, so the browser downloads it without leaving the page
        window.location.href = `/api/activity/export?${apiQuery(filters, { withType: true })}`;
        setTimeout(() => setExporting(false), 1500);
    };

    const groups = useMemo(() => {
        const out: { key: string; label: string; items: ActivityItem[] }[] = [];
        for (const item of feed && !loading ? feed.items : []) {
            const d = new Date(item.createdAt);
            const key = dayKey(d);
            const last = out[out.length - 1];
            if (last && last.key === key) last.items.push(item);
            else out.push({ key, label: dayLabel(d, now), items: [item] });
        }
        return out;
    }, [feed, loading, now]);

    const filtered = Boolean(filters.delivery || filters.event || filters.person || filters.range !== '30d');
    const rangeDetail = RANGES.find((r) => r.value === filters.range)?.detail ?? '';
    const personLabel = filters.person ? (feed?.items.find((i) => i.recipientId === filters.person)?.actor ?? 'One person') : null;
    const knownDelivery = deliveries?.some((d) => d.id === filters.delivery);
    const sends = deliveries?.filter((d) => d.kind !== 'request') ?? [];
    const requests = deliveries?.filter((d) => d.kind === 'request') ?? [];
    const statValue = (value: number | undefined | null) =>
        summaryData === undefined ? <Skeleton className="my-1 h-6 w-12" /> : value == null ? '—' : number.format(value);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Activity"
                description="Every open, download and denied attempt on your deliveries, with who, when and from where."
                actions={
                    <Button icon={<Download {...ICON} />} onClick={exportCsv} loading={exporting}>
                        Export CSV
                    </Button>
                }
            />

            <div className="flex flex-col gap-3">
                <Toolbar className="items-end gap-3">
                    <Field label="Delivery" className="w-full sm:w-64">
                        <Select value={filters.delivery} onChange={(e) => setFilters({ delivery: e.target.value })}>
                            <option value="">All deliveries</option>
                            {filters.delivery && deliveries && !knownDelivery && <option value={filters.delivery}>This delivery</option>}
                            {sends.length > 0 && (
                                <optgroup label="Deliveries">
                                    {sends.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.title}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {requests.length > 0 && (
                                <optgroup label="Requests">
                                    {requests.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.title}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </Select>
                    </Field>
                    <Field label="Event" className="w-full sm:w-48">
                        <Select value={filters.event} onChange={(e) => setFilters({ event: e.target.value })}>
                            <option value="">All events</option>
                            {EVENTS.map((e) => (
                                <option key={e.value} value={e.value}>
                                    {e.label}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    {/* Five presets don't fit a phone's width: a select there, segments from sm up */}
                    <Field label="Period" className="w-full sm:hidden">
                        <Select value={filters.range} onChange={(e) => setFilters({ range: e.target.value as RangeKey })}>
                            {RANGES.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <div className="hidden flex-col gap-1.5 sm:flex">
                        <span aria-hidden className="text-caption font-medium text-secondary">
                            Period
                        </span>
                        <SegmentedControl
                            label="Period"
                            value={filters.range}
                            onChange={(range) => setFilters({ range })}
                            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
                        />
                    </div>
                    {filters.range === 'custom' && (
                        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
                            <Field label="From" className="sm:w-40">
                                <Input
                                    type="date"
                                    value={filters.from}
                                    max={filters.to || undefined}
                                    onChange={(e) => setFilters({ from: e.target.value })}
                                    className="[color-scheme:dark]"
                                />
                            </Field>
                            <Field label="To" className="sm:w-40">
                                <Input
                                    type="date"
                                    value={filters.to}
                                    min={filters.from || undefined}
                                    onChange={(e) => setFilters({ to: e.target.value })}
                                    className="[color-scheme:dark]"
                                />
                            </Field>
                        </div>
                    )}
                    {filtered && (
                        <Button
                            variant="ghost"
                            icon={<X {...ICON} />}
                            onClick={() => setFilters({ delivery: '', event: '', person: '', range: '30d', from: '', to: '' })}
                        >
                            Clear filters
                        </Button>
                    )}
                </Toolbar>
                {filters.person && (
                    <div className="flex items-center gap-2 text-body-sm text-secondary">
                        Showing activity for <span className="font-medium text-strong">{personLabel}</span>
                        <Button size="sm" variant="ghost" onClick={() => setFilters({ person: '' })}>
                            Show everyone
                        </Button>
                    </div>
                )}
            </div>

            <section aria-label="Totals for this period" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Opens" value={statValue(summaryData?.opened)} detail={rangeDetail} />
                <StatCard label="Downloads" value={statValue(summaryData?.downloaded)} detail={rangeDetail} />
                <StatCard
                    label="Denied"
                    value={statValue(summaryData?.denied)}
                    detail={rangeDetail}
                    status={summaryData && summaryData.denied > 0 ? 'danger' : undefined}
                />
                {filters.delivery ? (
                    <StatCard label="People with access" value={statValue(summaryData?.activeRecipients)} detail="Can open it now" />
                ) : (
                    <StatCard label="Active deliveries" value={statValue(summaryData?.activeDeliveries)} detail="Can be opened now" />
                )}
            </section>

            {feed?.error && !loading ? (
                <Callout
                    tone="danger"
                    title="We couldn't load activity"
                    action={
                        <Button size="sm" onClick={() => setReloadToken((t) => t + 1)}>
                            Try again
                        </Button>
                    }
                >
                    {feed.error}
                </Callout>
            ) : loading ? (
                <Card flush aria-busy="true" aria-label="Loading activity">
                    <div className="border-b border-subtle px-4 py-2.5 sm:px-5">
                        <Skeleton className="h-4 w-36" />
                    </div>
                    <ul>
                        {Array.from({ length: 8 }, (_, i) => (
                            <li key={i} className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-b-0 sm:px-5">
                                <Skeleton className="h-7 w-7 shrink-0" />
                                <Skeleton className={i % 3 === 0 ? 'h-4 w-2/3' : i % 3 === 1 ? 'h-4 w-1/2' : 'h-4 w-3/5'} />
                                <Skeleton className="ml-auto h-3.5 w-14 shrink-0" />
                            </li>
                        ))}
                    </ul>
                </Card>
            ) : groups.length === 0 ? (
                <Card>
                    {filtered ? (
                        <EmptyState
                            icon={SearchX}
                            title="No activity matches these filters"
                            description="Try a longer period or a different delivery or event."
                            action={
                                <Button onClick={() => setFilters({ delivery: '', event: '', person: '', range: 'all', from: '', to: '' })}>
                                    Show all activity
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title="No activity yet"
                            description="When people open, download or are denied on your deliveries, every step shows up here."
                        />
                    )}
                </Card>
            ) : (
                <div className="flex flex-col gap-4">
                    {groups.map((group) => (
                        <Card flush key={group.key} className="overflow-hidden">
                            <h2 className="border-b border-subtle px-4 py-2.5 text-caption font-medium text-secondary sm:px-5">{group.label}</h2>
                            <ul>
                                {group.items.map((item) => (
                                    <ActivityRow
                                        key={item.id}
                                        item={item}
                                        expanded={rows.expanded(item.id)}
                                        onToggle={() => rows.toggle(item.id)}
                                        onFilterDelivery={filters.delivery ? undefined : (delivery) => setFilters({ delivery })}
                                        onFilterPerson={filters.person ? undefined : (person) => setFilters({ person })}
                                    />
                                ))}
                            </ul>
                        </Card>
                    ))}
                    {feed?.nextCursor ? (
                        <div className="flex justify-center">
                            <Button onClick={loadMore} loading={loadingMore}>
                                Show older activity
                            </Button>
                        </div>
                    ) : (
                        <p className="text-center text-caption text-tertiary">That&apos;s everything for this period.</p>
                    )}
                </div>
            )}
        </div>
    );
}
