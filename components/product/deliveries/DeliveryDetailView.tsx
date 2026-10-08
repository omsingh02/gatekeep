'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, ExternalLink, FileX, FolderOpen, KeyRound, Link2, MailCheck, Pencil, Plus, SearchX, Trash2, Upload, UserMinus, UserPlus, Users, X } from 'lucide-react';
import {
    Badge,
    Breadcrumb,
    Button,
    Callout,
    Card,
    CardHeader,
    Checkbox,
    ConfirmDialog,
    EmptyState,
    IconButton,
    Menu,
    PageHeader,
    Skeleton,
    StatCard,
    StatusPill,
    TBody,
    TD,
    TH,
    THead,
    TR,
    Table,
    Tabs,
    Tooltip,
    useToast,
    type MenuItem,
} from '@/components/ds';
import { api, errorMessage, type ActivityItem, type DeliveryDetail, type DeliveryFile, type DeliveryKind, type Recipient } from './api';
import { ActivityFeed, ActivityRow } from './ActivityFeed';
import { AddFilesDialog, AddPeopleDialog, ChangeAccessDialog, ChangePasswordDialog, EditDetailsDialog } from './DetailDialogs';
import { FileIcon, fileTypeLabel } from './FileIcon';
import { METHOD_LABELS, dateTime, downloadsLabel, formatSize, plural, possessive, recipientPill, shortDate, shortName, timeAgo, timeAgoInSentence } from './format';
import { useOwnerDefaults } from './hooks';
import { PersonAvatar } from './PersonAvatar';
import { useCopy } from './SentPanel';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

type Tab = 'recipients' | 'files' | 'activity';

/* ------------------------------------------------------------------------------------------ */
/* Recipients                                                                                  */
/* ------------------------------------------------------------------------------------------ */

function RecipientsPanel({
    delivery,
    emailConfigured,
    onAdd,
    onChanged,
}: {
    delivery: DeliveryDetail;
    emailConfigured: boolean | undefined;
    onAdd: () => void;
    onChanged: () => void;
}) {
    const toast = useToast();
    const isRequest = delivery.kind === 'request';
    const [removing, setRemoving] = useState<Recipient | null>(null);
    const [notify, setNotify] = useState(false);
    const [passwordFor, setPasswordFor] = useState<Recipient | null>(null);
    const [accessFor, setAccessFor] = useState<Recipient | null>(null);

    // Active people first, removed ones last (kept for the record)
    const rows = [...delivery.recipients].sort((a, b) => Number(Boolean(a.removedAt)) - Number(Boolean(b.removedAt)));

    const resend = async (r: Recipient) => {
        try {
            await api(`/api/deliveries/${delivery.id}/recipients/${r.id}/invite`, { method: 'POST' });
            toast.success(`Invite sent to ${r.label}`);
            onChanged();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };

    const remove = async () => {
        if (!removing) return;
        try {
            await api(`/api/deliveries/${delivery.id}/recipients/${removing.id}${notify ? '?notify=1' : ''}`, { method: 'DELETE' });
            toast.success(removing.kind === 'anyone' ? 'Removed access for anyone with the password' : `Removed ${possessive(removing.label)} access`);
            setRemoving(null);
            onChanged();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };

    const menuItems = (r: Recipient): MenuItem[] => {
        const items: MenuItem[] = [];
        if (r.identifierType === 'email') {
            items.push({ label: 'Resend invite', icon: <MailCheck {...ICON} />, disabled: emailConfigured === false, onSelect: () => resend(r) });
        }
        if (r.method === 'password') items.push({ label: 'Change password', icon: <KeyRound {...ICON} />, onSelect: () => setPasswordFor(r) });
        items.push({
            label: isRequest ? 'Change end date' : 'Change end date or limit',
            icon: <CalendarClock {...ICON} />,
            onSelect: () => setAccessFor(r),
        });
        items.push({ type: 'separator' });
        items.push({
            label: 'Remove access',
            icon: <UserMinus {...ICON} />,
            danger: true,
            onSelect: () => {
                setNotify(false);
                setRemoving(r);
            },
        });
        return items;
    };

    const actions = (r: Recipient) =>
        r.removedAt ? (
            <span className="inline-block h-8 w-8" aria-hidden />
        ) : (
            <Menu label={`More actions for ${r.label}`} items={menuItems(r)} />
        );

    const identity = (r: Recipient) => (
        <span className="flex min-w-0 items-center gap-2.5">
            <PersonAvatar label={r.label} />
            <span className="min-w-0">
                <span className={r.removedAt ? 'block truncate text-secondary line-through decoration-gray-6' : 'block truncate text-primary'}>{r.label}</span>
                {r.endsAt && !r.removedAt && <span className="block text-caption text-tertiary">Ends {shortDate(r.endsAt)}</span>}
            </span>
        </span>
    );

    const name = removing ? shortName(removing.label) : '';

    return (
        <Card flush>
            <CardHeader
                title={isRequest ? 'Who can upload' : 'Recipients'}
                description={isRequest ? 'Each person uploads with their own access.' : 'Each person has their own access. Remove it at any time.'}
                actions={
                    <Button variant="secondary" size="sm" icon={<UserPlus {...ICON} />} onClick={onAdd}>
                        Add people
                    </Button>
                }
            />
            {rows.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No one has access"
                    description={isRequest ? 'Add the people who should upload files.' : 'Add the people who should open this delivery.'}
                    action={
                        <Button variant="primary" icon={<UserPlus {...ICON} />} onClick={onAdd}>
                            Add people
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="hidden md:block">
                        <Table aria-label={isRequest ? 'Who can upload' : 'Recipients'}>
                            <THead>
                                <tr>
                                    <TH>Recipient</TH>
                                    <TH>Access method</TH>
                                    <TH>Status</TH>
                                    <TH>Last opened</TH>
                                    {!isRequest && <TH numeric>Downloads</TH>}
                                    <TH className="w-12">
                                        <span className="sr-only">Actions</span>
                                    </TH>
                                </tr>
                            </THead>
                            <TBody>
                                {rows.map((r) => {
                                    const pill = recipientPill(r);
                                    return (
                                        <TR key={r.id} data-testid="recipient-row">
                                            <TD strong className="max-w-[320px]">
                                                {identity(r)}
                                            </TD>
                                            <TD>
                                                <Badge>{METHOD_LABELS[r.method]}</Badge>
                                            </TD>
                                            <TD>
                                                <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                                            </TD>
                                            <TD>
                                                {r.lastOpenedAt ? (
                                                    <span title={dateTime(r.lastOpenedAt)} className="whitespace-nowrap">
                                                        {timeAgo(r.lastOpenedAt)}
                                                    </span>
                                                ) : (
                                                    <span className="text-tertiary">Not yet</span>
                                                )}
                                            </TD>
                                            {!isRequest && <TD numeric>{downloadsLabel(r)}</TD>}
                                            <TD className="text-right">{actions(r)}</TD>
                                        </TR>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </div>
                    <ul className="divide-y divide-gray-4 md:hidden" aria-label={isRequest ? 'Who can upload' : 'Recipients'}>
                        {rows.map((r) => {
                            const pill = recipientPill(r);
                            return (
                                <li key={r.id} className="flex items-start gap-3 px-4 py-3" data-testid="recipient-card">
                                    <div className="min-w-0 flex-1">
                                        {identity(r)}
                                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-8.5">
                                            <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                                            <Badge>{METHOD_LABELS[r.method]}</Badge>
                                        </div>
                                        <p className="mt-1.5 pl-8.5 text-caption text-tertiary">
                                            {r.lastOpenedAt ? `Opened ${timeAgoInSentence(r.lastOpenedAt)}` : 'Not opened yet'}
                                            {!isRequest &&
                                                ` · ${r.downloadLimit !== null ? `${downloadsLabel(r)} downloads` : plural(r.downloadCount, 'download')}`}
                                        </p>
                                    </div>
                                    <div className="-mr-1.5">{actions(r)}</div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            <ConfirmDialog
                open={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={remove}
                destructive
                title={removing?.kind === 'anyone' ? 'Remove access for anyone with the password?' : `Remove ${possessive(removing?.label ?? '')} access?`}
                confirmLabel="Remove access"
            >
                <div className="flex flex-col gap-4">
                    <p>
                        {removing?.kind === 'anyone'
                            ? 'The shared password stops working. If the delivery is open on someone’s screen, it closes right away.'
                            : `If the ${isRequest ? 'request' : 'delivery'} is open on their screen, it closes right away. What ${name} did stays in the activity.`}
                    </p>
                    {removing?.identifierType === 'email' && emailConfigured !== false && (
                        <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label={`Email ${name} that their access was removed`} />
                    )}
                </div>
            </ConfirmDialog>
            <ChangePasswordDialog deliveryId={delivery.id} recipient={passwordFor} onClose={() => setPasswordFor(null)} onChanged={onChanged} />
            <ChangeAccessDialog deliveryId={delivery.id} kind={delivery.kind} recipient={accessFor} onClose={() => setAccessFor(null)} onChanged={onChanged} />
        </Card>
    );
}

/* ------------------------------------------------------------------------------------------ */
/* Files                                                                                       */
/* ------------------------------------------------------------------------------------------ */

function FilesPanel({ delivery, onChanged }: { delivery: DeliveryDetail; onChanged: () => void }) {
    const toast = useToast();
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState<DeliveryFile | null>(null);
    const total = delivery.files.reduce((sum, f) => sum + f.size, 0);
    const only = delivery.files.length === 1;

    const remove = async () => {
        if (!removing) return;
        try {
            await api(`/api/deliveries/${delivery.id}`, {
                method: 'PATCH',
                json: { fileIds: delivery.files.filter((f) => f.id !== removing.id).map((f) => f.id) },
            });
            toast.success(`Removed ${removing.name} from this delivery`);
            setRemoving(null);
            onChanged();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };

    return (
        <Card flush>
            <CardHeader
                title="Files"
                description={`${plural(delivery.files.length, 'file')} · ${formatSize(total)}`}
                actions={
                    <Button variant="secondary" size="sm" icon={<Plus {...ICON} />} onClick={() => setAdding(true)}>
                        Add files
                    </Button>
                }
            />
            {delivery.files.length === 0 ? (
                <EmptyState icon={FileX} title="No files" description="The files in this delivery were deleted. Add files so people have something to open." />
            ) : (
                <ul className="divide-y divide-gray-4" aria-label="Files in this delivery">
                    {delivery.files.map((file) => (
                        <li key={file.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 sm:px-5">
                            <FileIcon mimeType={file.mimeType} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-body text-primary">{file.name}</p>
                                <p className="text-caption tabular-nums text-tertiary">
                                    {fileTypeLabel(file.name, file.mimeType)} · {formatSize(file.size)}
                                </p>
                            </div>
                            {only ? (
                                <Tooltip content="A delivery needs at least one file">
                                    <IconButton label={`Remove ${file.name} from this delivery`} size="sm" icon={<X {...ICON} />} disabled />
                                </Tooltip>
                            ) : (
                                <IconButton label={`Remove ${file.name} from this delivery`} size="sm" icon={<X {...ICON} />} onClick={() => setRemoving(file)} />
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <AddFilesDialog open={adding} onClose={() => setAdding(false)} delivery={delivery} onSaved={onChanged} />
            <ConfirmDialog
                open={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={remove}
                destructive
                title={`Remove ${removing?.name ?? ''} from this delivery?`}
                confirmLabel="Remove from delivery"
            >
                People on this delivery won&apos;t see it anymore. The file stays in Files.
            </ConfirmDialog>
        </Card>
    );
}

/* ------------------------------------------------------------------------------------------ */
/* Files received (requests)                                                                   */
/* ------------------------------------------------------------------------------------------ */

function ReceivedPanel({ delivery, uploads }: { delivery: DeliveryDetail; uploads: ActivityItem[] | null }) {
    const router = useRouter();
    const folder = delivery.requestFolder;
    const folderHref = folder ? `/admin/files?folder=${folder.id}` : '/admin/files';
    return (
        <Card flush>
            <CardHeader
                title="Files received"
                description={`Saved to ${folder?.name ?? 'All files'}${delivery.request?.maxFiles ? ` · up to ${plural(delivery.request.maxFiles, 'file')} per person` : ''}${delivery.request?.maxFileMb ? ` · ${delivery.request.maxFileMb} MB each` : ''}`}
                actions={
                    <Button variant="secondary" size="sm" icon={<FolderOpen {...ICON} />} onClick={() => router.push(folderHref)}>
                        Open folder
                    </Button>
                }
            />
            {uploads === null ? (
                <div className="flex flex-col gap-3 px-5 py-4">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-4 w-48" />
                </div>
            ) : uploads.length === 0 ? (
                <EmptyState icon={Upload} title="Nothing uploaded yet" description={`Files people upload appear here and in ${folder?.name ?? 'All files'}.`} />
            ) : (
                <ul className="divide-y divide-gray-4" aria-label="Files received">
                    {uploads.map((item) => (
                        <ActivityRow key={item.id} item={item} />
                    ))}
                </ul>
            )}
        </Card>
    );
}

/* ------------------------------------------------------------------------------------------ */
/* Page                                                                                        */
/* ------------------------------------------------------------------------------------------ */

function DetailSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
            <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-4 w-56" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <Card key={i} className="flex flex-col gap-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-7 w-10" />
                    </Card>
                ))}
            </div>
            <Skeleton className="h-10 w-72" />
            <Card flush>
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex h-12 items-center gap-3 border-b border-subtle px-5 last:border-b-0">
                        <Skeleton className="h-6 w-6" />
                        <Skeleton className="h-3.5 w-48" />
                        <Skeleton className="ml-auto h-5 w-16" />
                    </div>
                ))}
            </Card>
        </div>
    );
}

export function DeliveryDetailView({ id, kind }: { id: string; kind: DeliveryKind }) {
    const router = useRouter();
    const toast = useToast();
    const copy = useCopy();
    const defaults = useOwnerDefaults();
    const isRequest = kind === 'request';
    const listHref = isRequest ? '/admin/requests' : '/admin/deliveries';

    const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [denied, setDenied] = useState<{ count: number; more: boolean } | null>(null);
    const [uploads, setUploads] = useState<ActivityItem[] | null>(null);
    const [tab, setTab] = useState<Tab>('recipients');
    const [version, setVersion] = useState(0);
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    useEffect(() => {
        let cancelled = false;
        api<{ delivery: DeliveryDetail }>(`/api/deliveries/${id}`)
            .then(({ delivery }) => {
                if (cancelled) return;
                // A request opened under /deliveries (or the reverse): send it to its own page
                if (delivery.kind !== kind) {
                    router.replace(`${delivery.kind === 'request' ? '/admin/requests' : '/admin/deliveries'}/${delivery.id}`);
                    return;
                }
                setDelivery(delivery);
                setError(null);
            })
            .catch((err) => {
                if (cancelled) return;
                if (err?.status === 404) setNotFound(true);
                else setError(errorMessage(err));
            });
        api<{ items: ActivityItem[]; nextCursor: string | null }>(`/api/activity?delivery=${id}&type=denied&limit=100`)
            .then((page) => !cancelled && setDenied({ count: page.items.length, more: Boolean(page.nextCursor) }))
            .catch(() => !cancelled && setDenied({ count: 0, more: false }));
        if (isRequest) {
            api<{ items: ActivityItem[] }>(`/api/activity?delivery=${id}&type=uploaded&limit=100`)
                .then((page) => !cancelled && setUploads(page.items))
                .catch(() => !cancelled && setUploads([]));
        }
        return () => {
            cancelled = true;
        };
    }, [id, kind, isRequest, router, version]);

    if (notFound) {
        return (
            <Card>
                <EmptyState
                    icon={SearchX}
                    title={isRequest ? "This request doesn't exist" : "This delivery doesn't exist"}
                    description="It may have been deleted. Deleted links stop working for everyone."
                    action={<Button onClick={() => router.push(listHref)}>{isRequest ? 'Back to requests' : 'Back to deliveries'}</Button>}
                />
            </Card>
        );
    }
    if (error && !delivery) {
        return (
            <Callout tone="danger" action={<Button variant="link" size="sm" onClick={refresh}>Try again</Button>}>
                {error}
            </Callout>
        );
    }
    if (!delivery) return <DetailSkeleton />;

    const active = delivery.recipients.filter((r) => !r.removedAt);
    const activeNow = delivery.recipients.filter((r) => r.status === 'active').length;
    const people = active.filter((r) => r.kind === 'person').length;
    const anyone = active.some((r) => r.kind === 'anyone');
    const meta = [
        isRequest ? `Saves to ${delivery.requestFolder?.name ?? 'All files'}` : plural(delivery.files.length, 'file'),
        `${plural(people, isRequest ? 'person' : 'recipient', isRequest ? 'people' : 'recipients')}${anyone ? ' + anyone with the password' : ''}`,
        `created ${shortDate(delivery.createdAt)}`,
    ].join(' · ');

    const remove = async () => {
        try {
            await api(`/api/deliveries/${delivery.id}`, { method: 'DELETE' });
            toast.success(`Deleted ${delivery.title}`);
            router.push(listHref);
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };

    const tabs = [
        { value: 'recipients' as const, label: isRequest ? 'People' : 'Recipients', count: active.length },
        isRequest
            ? { value: 'files' as const, label: 'Files received', count: uploads?.length }
            : { value: 'files' as const, label: 'Files', count: delivery.files.length },
        { value: 'activity' as const, label: 'Activity' },
    ];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                breadcrumb={<Breadcrumb items={[{ label: isRequest ? 'Requests' : 'Deliveries', href: listHref }, { label: delivery.title }]} />}
                title={<span className="break-words">{delivery.title}</span>}
                description={meta}
                actions={
                    <>
                        <Button variant="secondary" icon={<Link2 {...ICON} />} onClick={() => copy(delivery.link, 'Link copied')}>
                            Copy link
                        </Button>
                        <Button variant="primary" icon={<UserPlus {...ICON} />} onClick={() => setAdding(true)}>
                            Add people
                        </Button>
                        <Menu
                            label={`More actions for ${delivery.title}`}
                            items={[
                                { label: 'Edit details', icon: <Pencil {...ICON} />, onSelect: () => setEditing(true) },
                                { label: 'Open link', icon: <ExternalLink {...ICON} />, onSelect: () => window.open(delivery.link, '_blank', 'noopener,noreferrer') },
                                { type: 'separator' },
                                {
                                    label: isRequest ? 'Delete request' : 'Delete delivery',
                                    icon: <Trash2 {...ICON} />,
                                    danger: true,
                                    onSelect: () => setDeleting(true),
                                },
                            ]}
                        />
                    </>
                }
            />

            {delivery.message && (
                <p className="-mt-2 max-w-3xl whitespace-pre-line border-l-2 border-default pl-3 text-body-sm text-secondary">{delivery.message}</p>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label="Opens"
                    value={delivery.stats.opens.toLocaleString('en-US')}
                    detail={delivery.stats.lastOpenedAt ? `Last opened ${timeAgoInSentence(delivery.stats.lastOpenedAt)}` : 'Not opened yet'}
                />
                {isRequest ? (
                    <StatCard label="Files received" value={uploads === null ? '–' : uploads.length.toLocaleString('en-US')} detail={`In ${delivery.requestFolder?.name ?? 'All files'}`} />
                ) : (
                    <StatCard
                        label="Downloads"
                        value={delivery.stats.downloads.toLocaleString('en-US')}
                        detail={plural(delivery.files.length, 'file')}
                    />
                )}
                <StatCard
                    label="Denied attempts"
                    value={denied === null ? '–' : `${denied.count}${denied.more ? '+' : ''}`}
                    status={denied && denied.count > 0 ? 'danger' : undefined}
                    detail={denied && denied.count > 0 ? 'See Activity for reasons' : 'None so far'}
                />
                <StatCard
                    label={isRequest ? 'People' : 'Recipients'}
                    value={active.length}
                    detail={activeNow === active.length ? (active.length ? 'All active' : 'No one yet') : `${activeNow} active`}
                />
            </div>

            <div className="flex flex-col gap-4">
                <Tabs label={isRequest ? 'Request sections' : 'Delivery sections'} value={tab} onChange={setTab} items={tabs} />
                <div role="tabpanel" id={`${tab}-panel`} aria-labelledby={`${tab}-tab`}>
                    {tab === 'recipients' && (
                        <RecipientsPanel delivery={delivery} emailConfigured={defaults.emailConfigured} onAdd={() => setAdding(true)} onChanged={refresh} />
                    )}
                    {tab === 'files' && (isRequest ? <ReceivedPanel delivery={delivery} uploads={uploads} /> : <FilesPanel delivery={delivery} onChanged={refresh} />)}
                    {tab === 'activity' && <ActivityFeed deliveryId={delivery.id} version={version} />}
                </div>
            </div>

            <AddPeopleDialog
                open={adding}
                onClose={() => setAdding(false)}
                delivery={delivery}
                emailConfigured={defaults.emailConfigured}
                defaultMethod={defaults.defaultMethod}
                onAdded={refresh}
            />
            <EditDetailsDialog open={editing} onClose={() => setEditing(false)} delivery={delivery} onSaved={refresh} />
            <ConfirmDialog
                open={deleting}
                onClose={() => setDeleting(false)}
                onConfirm={remove}
                destructive
                title={`Delete ${delivery.title}?`}
                confirmLabel={isRequest ? 'Delete request' : 'Delete delivery'}
            >
                {isRequest
                    ? 'The link stops working for everyone right away, and nobody can upload through it. Files already received stay in Files.'
                    : `The link stops working for everyone right away, including ${plural(people, 'person', 'people')} who may have it open. The files stay in Files.`}
            </ConfirmDialog>
        </div>
    );
}

