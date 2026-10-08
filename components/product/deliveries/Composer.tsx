'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FolderPlus, Plus, Send } from 'lucide-react';
import {
    Breadcrumb,
    Button,
    Callout,
    Card,
    DateTimePicker,
    Field,
    Input,
    PageHeader,
    PromptDialog,
    Select,
    Skeleton,
    Switch,
    Textarea,
    cn,
    useToast,
} from '@/components/ds';
import { api, errorMessage, type DeliveryDetail, type DeliveryKind, type LibraryFile, type RecipientResult } from './api';
import { FilePicker, SelectedFiles, loadFilesById } from './FilePicker';
import { endsLabel, formatSize, plural, titleFromFileName } from './format';
import { useOwnerDefaults } from './hooks';
import { RecipientEditor, addPeople, emptyRecipients, toRecipientInputs, type RecipientsDraft } from './RecipientEditor';
import { SentPanel } from './SentPanel';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
const DAY = 24 * 60 * 60 * 1000;

interface FolderOption {
    id: string;
    path: string;
}

/** Every folder as "Clients / Acme", in tree order. */
async function loadFolderOptions(): Promise<FolderOption[]> {
    const walk = async (parentId: string | null, prefix: string, depth: number): Promise<FolderOption[]> => {
        const { folders } = await api<{ folders: { id: string; name: string }[] }>(`/api/folders${parentId ? `?parentId=${parentId}` : ''}`);
        const children = await Promise.all(
            folders.map(async (f) => {
                const path = prefix ? `${prefix} / ${f.name}` : f.name;
                return [{ id: f.id, path }, ...(depth < 4 ? await walk(f.id, path, depth + 1) : [])];
            }),
        );
        return children.flat();
    };
    return walk(null, '', 0);
}

function Section({
    step,
    title,
    description,
    done,
    children,
    id,
}: {
    step: number;
    title: string;
    description: string;
    done?: boolean;
    children: ReactNode;
    id: string;
}) {
    return (
        <Card flush id={id} aria-labelledby={`${id}-title`} role="group" className="scroll-mt-6">
            <div className="flex items-start gap-3 border-b border-subtle px-4 py-3.5 sm:px-5">
                <span
                    aria-hidden
                    className={cn(
                        'mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-caption font-medium tabular-nums',
                        done ? 'border-gray-10 bg-gray-10 text-gray-1' : 'border-default bg-raised text-secondary',
                    )}
                >
                    {done ? <Check strokeWidth={2.5} className="h-3.5 w-3.5" /> : step}
                </span>
                <div className="min-w-0">
                    <h2 id={`${id}-title`} className="text-h3 text-strong">
                        {title}
                    </h2>
                    <p className="text-body-sm text-secondary">{description}</p>
                </div>
            </div>
            <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
        </Card>
    );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-body-sm text-secondary">{label}</dt>
            <dd className="min-w-0 text-right text-body-sm text-primary">{children}</dd>
        </div>
    );
}

interface Errors {
    files?: string;
    people?: string;
    title?: string;
    limit?: string;
    maxFiles?: string;
    maxFileMb?: string;
}

export interface ComposerProps {
    kind: DeliveryKind;
    /** ?files=id1,id2 */
    initialFileIds?: string[];
}

/**
 * New delivery / new request: one page, clear sections, fast for the common case (pick files,
 * type an email, send). After sending, the page becomes the Sent panel.
 */
export function Composer({ kind, initialFileIds = [] }: ComposerProps) {
    const router = useRouter();
    const toast = useToast();
    const defaults = useOwnerDefaults();
    const isRequest = kind === 'request';
    const noun = isRequest ? 'request' : 'delivery';
    const listHref = isRequest ? '/admin/requests' : '/admin/deliveries';

    // Files
    const [files, setFiles] = useState<LibraryFile[]>([]);
    const [filesLoading, setFilesLoading] = useState(initialFileIds.length > 0);
    const [pickerOpen, setPickerOpen] = useState(initialFileIds.length === 0);

    // People
    const [recipients, setRecipients] = useState<RecipientsDraft>(() => emptyRecipients());

    // Details
    const [title, setTitle] = useState('');
    const [titleTouched, setTitleTouched] = useState(false);
    const [message, setMessage] = useState('');
    const [endsAt, setEndsAt] = useState<Date | null>(null);
    const [limit, setLimit] = useState('');
    const [sendInvites, setSendInvites] = useState(true);

    // Request
    const [folders, setFolders] = useState<FolderOption[] | null>(isRequest ? null : []);
    const [folderId, setFolderId] = useState('');
    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [maxFiles, setMaxFiles] = useState('');
    const [maxFileMb, setMaxFileMb] = useState('');

    const [errors, setErrors] = useState<Errors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ delivery: DeliveryDetail; recipients: RecipientResult[] } | null>(null);
    const topRef = useRef<HTMLDivElement>(null);

    // Preselected files from ?files=
    useEffect(() => {
        if (initialFileIds.length === 0) return;
        let cancelled = false;
        loadFilesById(initialFileIds).then((loaded) => {
            if (cancelled) return;
            setFiles(loaded);
            setFilesLoading(false);
            if (loaded.length === 0) setPickerOpen(true);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first load
    }, []);

    // Sharing defaults from Settings, once they arrive
    useEffect(() => {
        if (!defaults.loaded) return;
        setRecipients((r) => ({ ...r, preferred: defaults.defaultMethod }));
        if (defaults.defaultEndsInDays) setEndsAt(new Date(Date.now() + defaults.defaultEndsInDays * DAY));
        if (defaults.defaultDownloadLimit) setLimit(String(defaults.defaultDownloadLimit));
        if (defaults.emailConfigured === false) setSendInvites(false);
    }, [defaults.loaded, defaults.defaultMethod, defaults.defaultEndsInDays, defaults.defaultDownloadLimit, defaults.emailConfigured]);

    useEffect(() => {
        if (!isRequest) return;
        loadFolderOptions()
            .then(setFolders)
            .catch(() => setFolders([]));
    }, [isRequest]);

    // The title follows the first file until it's edited
    const firstFile = files[0]?.originalFilename;
    useEffect(() => {
        if (!titleTouched && !isRequest) setTitle(firstFile ? titleFromFileName(firstFile) : '');
    }, [firstFile, titleTouched, isRequest]);

    const emailConfigured = defaults.emailConfigured;
    const people = recipients.people;
    const emailPeople = people.filter((p) => p.identifierType === 'email').length;
    const invitesOn = sendInvites && emailConfigured !== false;
    const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);

    const validate = (draft: RecipientsDraft): Errors => {
        const next: Errors = {};
        if (!isRequest && files.length === 0) next.files = 'Choose at least one file.';
        if (draft.people.length === 0 && !draft.anyone.enabled) next.people = 'Add at least one person, or turn on anyone with the password.';
        if (!title.trim()) next.title = `Give the ${noun} a title.`;
        const positive = (v: string) => v.trim() === '' || (/^\d+$/.test(v.trim()) && Number(v) >= 1);
        if (!isRequest && !positive(limit)) next.limit = 'Enter a whole number of at least 1, or leave it empty.';
        if (isRequest && (!positive(maxFiles) || Number(maxFiles) > 500)) next.maxFiles = 'Enter a number from 1 to 500, or leave it empty.';
        if (isRequest && (!positive(maxFileMb) || Number(maxFileMb) > 100)) next.maxFileMb = 'Enter a size from 1 to 100 MB, or leave it empty.';
        return next;
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitError(null);
        // Whatever is still in the people input counts
        let draft = recipients;
        if (draft.pending.trim()) {
            const added = addPeople(draft, draft.pending, { emailConfigured: emailConfigured !== false });
            draft = added.draft;
            setRecipients(draft);
            if (added.invalid.length) {
                setErrors({ people: `“${added.invalid[0]}” isn't a valid email address or username.` });
                document.getElementById('section-people')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }
        const found = validate(draft);
        setErrors(found);
        const first = (['files', 'people', 'title', 'limit', 'maxFiles', 'maxFileMb'] as const).find((k) => found[k]);
        if (first) {
            const section =
                first === 'files'
                    ? 'section-files'
                    : first === 'people'
                      ? 'section-people'
                      : first === 'maxFiles' || first === 'maxFileMb'
                        ? 'section-limits'
                        : 'section-details';
            document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const access = { endsAt: endsAt ? endsAt.toISOString() : null, downloadLimit: !isRequest && limit.trim() ? Number(limit) : null };
        setSubmitting(true);
        try {
            const body = await api<{ delivery: DeliveryDetail; recipients: RecipientResult[] }>('/api/deliveries', {
                method: 'POST',
                json: {
                    kind,
                    title: title.trim(),
                    message: message.trim() || undefined,
                    ...(isRequest
                        ? {
                              request: {
                                  folderId: folderId || null,
                                  maxFiles: maxFiles.trim() ? Number(maxFiles) : null,
                                  maxFileMb: maxFileMb.trim() ? Number(maxFileMb) : null,
                              },
                          }
                        : { fileIds: files.map((f) => f.id) }),
                    ...toRecipientInputs(draft, access),
                    sendInvites: invitesOn,
                },
            });
            setResult(body);
            const count = body.recipients.filter((r) => r.kind === 'person').length;
            const emailed = body.recipients.some((r) => r.inviteSent);
            toast.success(
                emailed
                    ? `${isRequest ? 'Request' : 'Delivery'} sent to ${plural(count, 'person', 'people')}`
                    : `${isRequest ? 'Request' : 'Delivery'} created`,
            );
            topRef.current?.scrollIntoView({ block: 'start' });
            window.scrollTo({ top: 0 });
        } catch (err) {
            setSubmitError(errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setResult(null);
        setFiles([]);
        setPickerOpen(true);
        setRecipients(emptyRecipients(defaults.defaultMethod));
        setTitle('');
        setTitleTouched(false);
        setMessage('');
        setErrors({});
        router.replace(isRequest ? '/admin/requests/new' : '/admin/deliveries/new');
    };

    const crumbs = (
        <Breadcrumb items={[{ label: isRequest ? 'Requests' : 'Deliveries', href: listHref }, { label: isRequest ? 'New request' : 'New delivery' }]} />
    );

    if (result) {
        return (
            <div ref={topRef} className="flex flex-col gap-6">
                {crumbs}
                <SentPanel
                    kind={kind}
                    title={result.delivery.title}
                    link={result.delivery.link}
                    recipients={result.recipients}
                    actions={
                        <>
                            <Button variant="secondary" icon={<Plus {...ICON} />} onClick={reset}>
                                {isRequest ? 'New request' : 'New delivery'}
                            </Button>
                            <Button variant="primary" onClick={() => router.push(`${listHref}/${result.delivery.id}`)}>
                                {isRequest ? 'View request' : 'View delivery'}
                            </Button>
                        </>
                    }
                />
            </div>
        );
    }

    const peopleDone = people.length > 0 || recipients.anyone.enabled;
    const detailsDone = Boolean(title.trim());
    const sendLabel = invitesOn && emailPeople > 0 ? `Send to ${plural(people.length, 'person', 'people')}` : `Create ${noun}`;

    const accessEnds = (
        <div className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-secondary">Access ends</span>
            {defaults.loaded ? (
                <DateTimePicker label="Access ends" value={endsAt} onChange={setEndsAt} />
            ) : (
                <Skeleton className="h-8 w-full max-w-md" />
            )}
        </div>
    );

    const invitesSwitch = (
        <Switch
            checked={invitesOn}
            onCheckedChange={setSendInvites}
            disabled={emailConfigured === false}
            label="Send invites by email"
            description={
                emailConfigured === false
                    ? "This Gatekeep can't send email yet, so you'll copy each invite after creating it. Set up email in Settings → System status."
                    : 'People with an email address get the link and how to get in. Passwords are never in the email.'
            }
        />
    );

    const detailsFields = (
        <div className="flex flex-col gap-5">
            <Field label="Title" error={errors.title} helper={isRequest ? 'People see this when they open the link.' : 'People see this once they open the link.'}>
                <Input
                    value={title}
                    maxLength={200}
                    placeholder={isRequest ? 'Signed contract and ID' : 'Q3 board pack'}
                    onChange={(event) => {
                        setTitle(event.target.value);
                        setTitleTouched(true);
                        if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
                    }}
                />
            </Field>
            <Field label="Message" helper={isRequest ? 'Optional. Say what you need and by when.' : 'Optional. Shown with the files and in the invite.'}>
                <Textarea
                    value={message}
                    maxLength={2000}
                    rows={3}
                    placeholder={isRequest ? 'Please upload the signed contract and a copy of your ID.' : 'Here are the files we discussed.'}
                    onChange={(event) => setMessage(event.target.value)}
                />
            </Field>
        </div>
    );

    return (
        <div ref={topRef} className="flex flex-col gap-6">
            <PageHeader
                breadcrumb={crumbs}
                title={isRequest ? 'New request' : 'New delivery'}
                description={
                    isRequest
                        ? 'Ask people for files. Each person gets their own access, and uploads land in a folder you choose.'
                        : 'Choose files, add people, send. Each person gets their own access.'
                }
            />

            <form noValidate onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <div className="flex min-w-0 flex-col gap-6">
                    {!isRequest && (
                        <Section id="section-files" step={1} title="Files" description="What you're sending." done={files.length > 0}>
                            <div className="flex flex-col gap-4">
                                {filesLoading ? (
                                    <Skeleton className="h-24 w-full" />
                                ) : (
                                    <SelectedFiles files={files} onRemove={(id) => setFiles((list) => list.filter((f) => f.id !== id))} />
                                )}
                                {errors.files && files.length === 0 && (
                                    <p role="alert" className="text-caption text-danger">
                                        {errors.files}
                                    </p>
                                )}
                                {pickerOpen ? (
                                    <FilePicker
                                        selected={files}
                                        onChange={(next) => {
                                            setFiles(next);
                                            if (errors.files) setErrors((e) => ({ ...e, files: undefined }));
                                        }}
                                    />
                                ) : (
                                    <div>
                                        <Button variant="secondary" icon={<Plus {...ICON} />} onClick={() => setPickerOpen(true)}>
                                            Add files
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {isRequest && (
                        <Section id="section-details" step={1} title="What you need" description="Tell people what to upload, and where it goes." done={detailsDone}>
                            <div className="flex flex-col gap-5">
                                {detailsFields}
                                <Field label="Save uploads to" helper="Uploaded files land in this folder in Files.">
                                    <div className="flex gap-2">
                                        <div className="min-w-0 flex-1">
                                            {folders === null ? (
                                                <Skeleton className="h-8 w-full" />
                                            ) : (
                                                <Select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
                                                    <option value="">All files</option>
                                                    {folders.map((f) => (
                                                        <option key={f.id} value={f.id}>
                                                            {f.path}
                                                        </option>
                                                    ))}
                                                </Select>
                                            )}
                                        </div>
                                        <Button variant="secondary" icon={<FolderPlus {...ICON} />} onClick={() => setNewFolderOpen(true)}>
                                            New folder
                                        </Button>
                                    </div>
                                </Field>
                            </div>
                        </Section>
                    )}

                    <Section
                        id="section-people"
                        step={2}
                        title={isRequest ? 'Who can upload' : 'People'}
                        description={
                            isRequest
                                ? 'Each person proves it’s them with an email code or their own password.'
                                : 'Who can open it. Each person proves it’s them with an email code or their own password.'
                        }
                        done={peopleDone}
                    >
                        {emailConfigured === undefined && !defaults.loaded ? (
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : (
                            <RecipientEditor
                                value={recipients}
                                onChange={(next) => {
                                    setRecipients(next);
                                    if (errors.people && (next.people.length || next.anyone.enabled)) setErrors((e) => ({ ...e, people: undefined }));
                                }}
                                emailConfigured={emailConfigured}
                                kind={kind}
                                error={errors.people}
                            />
                        )}
                        {errors.people && recipients.people.length > 0 && (
                            <p role="alert" className="mt-2 text-caption text-danger">
                                {errors.people}
                            </p>
                        )}
                    </Section>

                    <Section
                        id={isRequest ? 'section-limits' : 'section-details'}
                        step={3}
                        title={isRequest ? 'Limits and invites' : 'Details'}
                        description={isRequest ? 'How long the link works and what it accepts.' : 'What people see, and how long they can open it.'}
                        done={isRequest ? detailsDone && peopleDone : detailsDone}
                    >
                        <div className="flex flex-col gap-5">
                            {!isRequest && detailsFields}
                            {accessEnds}
                            {isRequest ? (
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Field label="Most files" error={errors.maxFiles} helper="Optional. Up to 500 per person.">
                                        <Input type="number" inputMode="numeric" min={1} max={500} placeholder="No limit" value={maxFiles} onChange={(e) => setMaxFiles(e.target.value)} />
                                    </Field>
                                    <Field label="Largest file (MB)" error={errors.maxFileMb} helper="Optional. Up to 100 MB.">
                                        <Input type="number" inputMode="numeric" min={1} max={100} placeholder="100" value={maxFileMb} onChange={(e) => setMaxFileMb(e.target.value)} />
                                    </Field>
                                </div>
                            ) : (
                                <Field label="Download limit" error={errors.limit} helper="Optional. Downloads per person; Download all counts as one.">
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        placeholder="No limit"
                                        value={limit}
                                        className="max-w-40"
                                        onChange={(event) => {
                                            setLimit(event.target.value);
                                            if (errors.limit) setErrors((e) => ({ ...e, limit: undefined }));
                                        }}
                                    />
                                </Field>
                            )}
                            <div className="border-t border-subtle pt-4">{invitesSwitch}</div>
                        </div>
                    </Section>
                </div>

                <aside className="lg:sticky lg:top-6" aria-label="Review and send">
                    <Card flush>
                        <div className="border-b border-subtle px-4 py-3.5 sm:px-5">
                            <h2 className="text-h3 text-strong">Review and send</h2>
                        </div>
                        <dl className="divide-y divide-gray-4 px-4 sm:px-5">
                            <ReviewRow label="Title">
                                <span className={cn('line-clamp-2 break-words', !title.trim() && 'text-tertiary')}>{title.trim() || 'Not set'}</span>
                            </ReviewRow>
                            {!isRequest && (
                                <ReviewRow label="Files">
                                    {files.length ? (
                                        <span className="tabular-nums">
                                            {plural(files.length, 'file')} · {formatSize(totalSize)}
                                        </span>
                                    ) : (
                                        <span className="text-tertiary">None yet</span>
                                    )}
                                </ReviewRow>
                            )}
                            {isRequest && <ReviewRow label="Saves to">{folders?.find((f) => f.id === folderId)?.path ?? 'All files'}</ReviewRow>}
                            <ReviewRow label="People">
                                {people.length || recipients.anyone.enabled ? (
                                    <span>
                                        {people.length > 0 && plural(people.length, 'person', 'people')}
                                        {people.length > 0 && recipients.anyone.enabled && ' + '}
                                        {recipients.anyone.enabled && 'anyone with the password'}
                                    </span>
                                ) : (
                                    <span className="text-tertiary">None yet</span>
                                )}
                            </ReviewRow>
                            <ReviewRow label="Access">{endsAt ? endsLabel(endsAt.toISOString()) : 'No end date'}</ReviewRow>
                            {!isRequest && <ReviewRow label="Download limit">{limit.trim() ? `${limit} per person` : 'None'}</ReviewRow>}
                            {isRequest && (
                                <ReviewRow label="Accepts">
                                    {maxFiles.trim() ? `Up to ${plural(Number(maxFiles), 'file')}` : 'Any number of files'}
                                    {maxFileMb.trim() ? `, ${maxFileMb} MB each` : ''}
                                </ReviewRow>
                            )}
                            <ReviewRow label="Invites">{invitesOn ? (emailPeople ? `Emailed to ${plural(emailPeople, 'person', 'people')}` : 'Emailed') : 'You copy and send them'}</ReviewRow>
                        </dl>
                        <div className="flex flex-col gap-3 border-t border-subtle px-4 py-4 sm:px-5">
                            {submitError && <Callout tone="danger">{submitError}</Callout>}
                            <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting} icon={<Send {...ICON} />}>
                                {submitting ? 'Sending…' : sendLabel}
                            </Button>
                            <p className="text-center text-caption text-tertiary">
                                {people.some((p) => p.method === 'password') || recipients.anyone.enabled
                                    ? 'Passwords are shown once more after this, for you to copy.'
                                    : 'You can add people or remove access at any time.'}
                            </p>
                        </div>
                    </Card>
                </aside>
            </form>

            <PromptDialog
                open={newFolderOpen}
                onClose={() => setNewFolderOpen(false)}
                title="New folder"
                label="Folder name"
                placeholder="Client uploads"
                submitLabel="Create folder"
                onSubmit={async (name) => {
                    try {
                        const { folder } = await api<{ folder: { id: string; name: string } }>('/api/folders', { method: 'POST', json: { name } });
                        setFolders((list) => [...(list ?? []), { id: folder.id, path: folder.name }]);
                        setFolderId(folder.id);
                        setNewFolderOpen(false);
                        toast.success(`Created ${folder.name}`);
                    } catch (err) {
                        toast.error(errorMessage(err));
                    }
                }}
            />
        </div>
    );
}
