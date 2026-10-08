'use client';

import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, cn } from '@/components/ds';
import { ActivityIcon } from '@/components/product/deliveries/ActivityIcon';
import type { ActivityItem } from '@/lib/deliveries/activity-query';

/** Same label the API uses for the "Anyone with the password" recipient (lib/deliveries/labels.ts). */
const ANYONE = 'Anyone with the password';

function Strong({ children }: { children: ReactNode }) {
    return <span className="font-medium text-strong">{children}</span>;
}

function lowerFirst(text: string) {
    return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "Maya Chen opened Q3 board pack": who did what, to which delivery, in plain words. */
export function activitySentence(item: ActivityItem): ReactNode {
    const anyone = item.actor === ANYONE;
    const target = <Strong>{item.deliveryTitle ?? (item.deliveryId ? 'a deleted delivery' : 'your files')}</Strong>;
    const file = item.fileName ? <Strong>{item.fileName}</Strong> : 'a file';
    const who = <Strong>{anyone ? 'Someone with the password' : item.actor}</Strong>;

    switch (item.type) {
        case 'opened':
            return <>{who} opened {target}</>;
        case 'previewed':
            return <>{who} previewed {file} on {target}</>;
        case 'downloaded':
            return <>{who} downloaded {file} from {target}</>;
        case 'downloaded_all':
            return <>{who} downloaded all files from {target}</>;
        case 'denied': {
            const extra = [item.reasonLabel ? lowerFirst(item.reasonLabel) : null, item.ip].filter(Boolean).join(' · ');
            return (
                <>
                    <Strong>{anyone ? 'Someone' : item.actor}</Strong> was denied on {target}
                    {extra && <span className="text-secondary"> — {extra}</span>}
                </>
            );
        }
        case 'code_sent':
            return <>Code sent to {who} for {target}</>;
        case 'invite_sent':
            return <>Invite sent to {who} for {target}</>;
        case 'uploaded':
            return <>{who} uploaded {file} to {target}</>;
        case 'access_given':
            return anyone ? <>You gave <Strong>anyone with the password</Strong> access to {target}</> : <>You gave {who} access to {target}</>;
        case 'access_removed':
            return anyone ? (
                <>You removed access for <Strong>anyone with the password</Strong> on {target}</>
            ) : (
                <>You removed <Strong>{item.actor}</Strong>&apos;s access to {target}</>
            );
        default:
            return <>{item.typeLabel}</>;
    }
}

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const fullFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' });

export function formatTime(iso: string) {
    return timeFormat.format(new Date(iso));
}

function Detail({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption font-medium text-tertiary">{label}</dt>
            <dd className={cn('break-words text-body-sm text-primary', mono && 'font-mono')}>{children}</dd>
        </div>
    );
}

export interface ActivityRowProps {
    item: ActivityItem;
    expanded: boolean;
    onToggle: () => void;
    onFilterDelivery?: (deliveryId: string) => void;
    onFilterPerson?: (recipientId: string) => void;
}

export function ActivityRow({ item, expanded, onToggle, onFilterDelivery, onFilterPerson }: ActivityRowProps) {
    const detailsId = useId();
    const created = new Date(item.createdAt);

    return (
        <li className="border-b border-subtle last:border-b-0" data-testid="activity-row" data-type={item.type}>
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={onToggle}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-raised focus-ring sm:px-5"
            >
                <ActivityIcon type={item.type} label={item.typeLabel} />
                <span className="min-w-0 flex-1 break-words pt-1 text-body-sm text-primary">{activitySentence(item)}</span>
                <span className="flex shrink-0 items-center gap-1.5 pt-1">
                    <time dateTime={item.createdAt} className="text-caption tabular-nums text-tertiary">
                        {formatTime(item.createdAt)}
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
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                            <Detail label="Event">
                                {item.typeLabel}
                                {item.reasonLabel && <span className="text-secondary"> · {item.reasonLabel}</span>}
                            </Detail>
                            <Detail label="Time">
                                {fullFormat.format(created)}{' '}
                                <span className="text-tertiary">({item.createdAt.replace('T', ' ').slice(0, 19)} UTC)</span>
                            </Detail>
                            <Detail label="Person">{item.actor}</Detail>
                            {item.deliveryId && <Detail label="Delivery">{item.deliveryTitle ?? 'Deleted delivery'}</Detail>}
                            {item.fileId && <Detail label="File">{item.fileName ?? 'Deleted file'}</Detail>}
                            <Detail label="IP address" mono>
                                {item.ip ?? '—'}
                            </Detail>
                            <Detail label="Request ID" mono>
                                {item.requestId ?? '—'}
                            </Detail>
                            <div className="sm:col-span-2 lg:col-span-3">
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
