'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton, StatusPill, TD, TH, TR } from '@/components/ds';
import type { DeliveryListItem } from './api';
import { DELIVERY_STATUS, dateTime, plural, timeAgoInSentence } from './format';
import { PersonAvatar } from './PersonAvatar';

/** One row of the Deliveries (or Requests) list, as a table row on wider screens and a summary on phones. */

function People({ item }: { item: DeliveryListItem }) {
    if (item.recipientCount === 0) return <span className="text-tertiary">No one yet</span>;
    const preview = item.recipientPreview ?? [];
    const first = preview[0];
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                {preview.map((name, i) => (
                    <PersonAvatar key={i} label={name} className="ring-2 ring-gray-2" />
                ))}
            </span>
            <span className="min-w-0 truncate text-body-sm text-secondary">
                {item.recipientCount === 1 && first ? first : plural(item.recipientCount, 'person', 'people')}
            </span>
        </span>
    );
}

/** "Opened 2h ago", or "Created Oct 6" when no one has opened it yet. */
function lastActivity(item: DeliveryListItem) {
    const { text, at } = item.lastOpenedAt
        ? { text: `Opened ${timeAgoInSentence(item.lastOpenedAt)}`, at: item.lastOpenedAt }
        : { text: `Created ${timeAgoInSentence(item.createdAt)}`, at: item.createdAt };
    return { text: text[0].toUpperCase() + text.slice(1), at };
}

function Status({ item }: { item: DeliveryListItem }) {
    const status = DELIVERY_STATUS[item.status];
    return <StatusPill tone={status.tone}>{status.label}</StatusPill>;
}

/** Header cells matching DeliveryTableRow. */
export function DeliveryTableHead({ isRequest, withActions = true }: { isRequest: boolean; withActions?: boolean }) {
    return (
        <tr>
            <TH>Title</TH>
            {!isRequest && <TH numeric>Files</TH>}
            <TH>{isRequest ? 'Who can upload' : 'Recipients'}</TH>
            <TH numeric>Opens</TH>
            <TH>Last activity</TH>
            <TH>Status</TH>
            {withActions && (
                <TH className="w-12">
                    <span className="sr-only">Actions</span>
                </TH>
            )}
        </tr>
    );
}

export function DeliveryTableRow({ item, href, isRequest, actions }: { item: DeliveryListItem; href: string; isRequest: boolean; actions?: ReactNode }) {
    const router = useRouter();
    const last = lastActivity(item);
    return (
        <TR interactive onClick={() => router.push(href)} data-testid="delivery-row">
            <TD strong className="max-w-[360px]">
                <Link href={href} onClick={(event) => event.stopPropagation()} className="block truncate rounded-sm font-medium text-strong hover:underline focus-ring">
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
                    {last.text}
                </span>
            </TD>
            <TD>
                <Status item={item} />
            </TD>
            {actions !== undefined && (
                <TD onClick={(event) => event.stopPropagation()} className="text-right">
                    {actions}
                </TD>
            )}
        </TR>
    );
}

/** Skeleton cells matching DeliveryTableRow. */
export function DeliveryTableRowSkeleton({ isRequest, withActions = true }: { isRequest: boolean; withActions?: boolean }) {
    return (
        <TR>
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
            {withActions && <TD />}
        </TR>
    );
}

/**
 * The phone layout of a row: title (the whole area opens it), counts, status and last activity.
 * The caller provides the surface: a Card in the list, a divided list item inside a card elsewhere.
 */
export function DeliverySummary({ item, href, isRequest, actions }: { item: DeliveryListItem; href: string; isRequest: boolean; actions?: ReactNode }) {
    const last = lastActivity(item);
    return (
        <>
            <div className="min-w-0 flex-1">
                <Link href={href} className="block truncate rounded-sm text-body font-medium text-strong focus-ring after:absolute after:inset-0">
                    {item.title}
                </Link>
                <p className="mt-1 text-caption text-secondary">
                    {[!isRequest ? plural(item.fileCount, 'file') : null, plural(item.recipientCount, 'person', 'people'), plural(item.opens, 'open')]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <Status item={item} />
                    <span className="text-caption text-tertiary">{last.text}</span>
                </div>
            </div>
            {actions && <div className="relative z-10 -mr-1.5 -mt-1">{actions}</div>}
        </>
    );
}
