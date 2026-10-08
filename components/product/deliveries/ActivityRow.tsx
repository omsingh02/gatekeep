'use client';

import { useCallback, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, cn } from '@/components/ds';
import type { ActivityItem } from '@/lib/deliveries/activity-query';
import { ActivityIcon } from './ActivityIcon';
import type { DeliveryKind } from './api';
import { ANYONE_LABEL, timeAgo } from './format';

function Strong({ children }: { children: ReactNode }) {
    return <span className="font-medium text-strong">{children}</span>;
}

function lowerFirst(text: string) {
    return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * "Maya Chen opened Q3 board pack": who did what, to which delivery, in plain words. Inside one
 * delivery or request (`within`), its name is left out: "Maya Chen opened the delivery".
 */
export function activitySentence(item: ActivityItem, within?: DeliveryKind): ReactNode {
    const anyone = item.actor === ANYONE_LABEL;
    const target = within ? null : <Strong>{item.deliveryTitle ?? (item.deliveryId ? 'a deleted delivery' : 'your files')}</Strong>;
    // " on Q3 board pack", or nothing inside the delivery itself
    const where = (word: string) => target && <> {word} {target}</>;
    const file = item.fileName ? <Strong>{item.fileName}</Strong> : 'a file';
    const who = <Strong>{anyone ? 'Someone with the password' : item.actor}</Strong>;

    switch (item.type) {
        case 'opened':
            return <>{who} opened {target ?? (within === 'request' ? 'the request' : 'the delivery')}</>;
        case 'previewed':
            return <>{who} previewed {file}{where('on')}</>;
        case 'downloaded':
            return <>{who} downloaded {file}{where('from')}</>;
        case 'downloaded_all':
            return <>{who} downloaded all files{where('from')}</>;
        case 'denied': {
            const extra = [item.reasonLabel ? lowerFirst(item.reasonLabel) : null, item.ip].filter(Boolean).join(' · ');
            return (
                <>
                    <Strong>{anyone ? 'Someone' : item.actor}</Strong> was denied{where('on')}
                    {extra && <span className="text-secondary"> — {extra}</span>}
                </>
            );
        }
        case 'code_sent':
            return <>Code sent to {who}{where('for')}</>;
        case 'invite_sent':
            return <>Invite sent to {who}{where('for')}</>;
        case 'uploaded':
            return <>{who} uploaded {file}{where('to')}</>;
        case 'access_given':
            return anyone ? <>You gave <Strong>anyone with the password</Strong> access{where('to')}</> : <>You gave {who} access{where('to')}</>;
        case 'access_removed':
            return anyone ? (
                <>You removed access for <Strong>anyone with the password</Strong>{where('on')}</>
            ) : (
                <>You removed <Strong>{item.actor}</Strong>&apos;s access{where('to')}</>
            );
        default:
            return <>{item.typeLabel}</>;
    }
}

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const fullFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' });

function Detail({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption font-medium text-tertiary">{label}</dt>
            <dd className={cn('break-words text-body-sm text-primary', mono && 'font-mono')}>{children}</dd>
        </div>
    );
}

/** Which rows are open: `expanded(id)` and `toggle(id)` for a list of ActivityRows. */
export function useExpandedRows() {
    const [open, setOpen] = useState<Set<string>>(() => new Set());
    const toggle = useCallback(
        (id: string) =>
            setOpen((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            }),
        [],
    );
    return { expanded: (id: string) => open.has(id), toggle };
}

export interface ActivityRowProps {
    item: ActivityItem;
    expanded: boolean;
    onToggle: () => void;
    /** Inside one delivery or request (its Activity tab): sentences and details leave out its name */
    within?: DeliveryKind;
    /** "3:04 PM" under a day heading (the Activity page); "2h ago" in lists without one */
    time?: 'clock' | 'relative';
    onFilterDelivery?: (deliveryId: string) => void;
    onFilterPerson?: (recipientId: string) => void;
}

/**
 * One event: icon, sentence and time. Select the row to see the details (exact time, IP address,
 * browser), the same way on a phone as with a mouse or keyboard.
 */
export function ActivityRow({ item, expanded, onToggle, within, time = 'clock', onFilterDelivery, onFilterPerson }: ActivityRowProps) {
    const detailsId = useId();
    const created = new Date(item.createdAt);

    return (
        <li className="@container border-b border-subtle last:border-b-0" data-testid="activity-row" data-type={item.type}>
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={onToggle}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-raised focus-ring sm:px-5"
            >
                <ActivityIcon type={item.type} label={item.typeLabel} />
                <span className="min-w-0 flex-1 break-words pt-1 text-body-sm text-primary">{activitySentence(item, within)}</span>
                <span className="flex shrink-0 items-center gap-1.5 pt-1">
                    <time dateTime={item.createdAt} className="whitespace-nowrap text-caption tabular-nums text-tertiary">
                        {time === 'relative' ? timeAgo(item.createdAt) : timeFormat.format(created)}
                    </time>
                    <ChevronDown
                        aria-hidden
                        strokeWidth={1.75}
                        className={cn('h-4 w-4 text-tertiary transition-transform duration-150', expanded && 'rotate-180')}
                    />
                </span>
            </button>
            {expanded && (
                <div id={detailsId} className="px-4 pb-4 sm:pl-15 sm:pr-5">
                    <div className="rounded-md border border-subtle bg-inset p-3 sm:p-4">
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 @xl:grid-cols-2 @3xl:grid-cols-3">
                            <Detail label="Event">
                                {item.typeLabel}
                                {item.reasonLabel && <span className="text-secondary"> · {item.reasonLabel}</span>}
                            </Detail>
                            <Detail label="Time">
                                {fullFormat.format(created)}{' '}
                                <span className="text-tertiary">({item.createdAt.replace('T', ' ').slice(0, 19)} UTC)</span>
                            </Detail>
                            <Detail label="Person">{item.actor}</Detail>
                            {item.deliveryId && !within && <Detail label="Delivery">{item.deliveryTitle ?? 'Deleted delivery'}</Detail>}
                            {item.fileId && <Detail label="File">{item.fileName ?? 'Deleted file'}</Detail>}
                            <Detail label="IP address" mono>
                                {item.ip ?? '—'}
                            </Detail>
                            <Detail label="Request ID" mono>
                                {item.requestId ?? '—'}
                            </Detail>
                            <div className="@xl:col-span-2 @3xl:col-span-3">
                                <Detail label="Browser">{item.userAgent ?? '—'}</Detail>
                            </div>
                        </dl>
                        {(onFilterDelivery || onFilterPerson) && (
                            <div className="mt-3 flex flex-wrap gap-4 border-t border-subtle pt-3 text-body-sm">
                                {onFilterDelivery && item.deliveryId && (
                                    <Button size="sm" variant="link" onClick={() => onFilterDelivery(item.deliveryId!)}>
                                        Only this delivery
                                    </Button>
                                )}
                                {onFilterPerson && item.recipientId && (
                                    <Button size="sm" variant="link" onClick={() => onFilterPerson(item.recipientId!)}>
                                        Only this person
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </li>
    );
}
