'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Copy } from 'lucide-react';
import {
    Button,
    Callout,
    Checkbox,
    CopyField,
    DateTimePicker,
    Dialog,
    Field,
    Input,
    Switch,
    Textarea,
    useToast,
} from '@/components/ds';
import { api, errorMessage, type DeliveryDetail, type LibraryFile, type Recipient, type RecipientResult } from './api';
import { FilePicker } from './FilePicker';
import { plural, possessive, shortName } from './format';
import { RecipientEditor, addPeople, emptyRecipients, toRecipientInputs, type RecipientsDraft } from './RecipientEditor';
import { RecipientResults, useCopy } from './SentPanel';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

/* ------------------------------------------------------------------------------------------ */
/* Add people                                                                                  */
/* ------------------------------------------------------------------------------------------ */

export function AddPeopleDialog({
    open,
    onClose,
    delivery,
    emailConfigured,
    defaultMethod,
    onAdded,
}: {
    open: boolean;
    onClose: () => void;
    delivery: DeliveryDetail;
    emailConfigured: boolean | undefined;
    defaultMethod: 'email_code' | 'password';
    onAdded: () => void;
}) {
    return open ? (
        <AddPeopleForm delivery={delivery} emailConfigured={emailConfigured} defaultMethod={defaultMethod} onClose={onClose} onAdded={onAdded} />
    ) : null;
}

function AddPeopleForm({
    onClose,
    delivery,
    emailConfigured,
    defaultMethod,
    onAdded,
}: {
    onClose: () => void;
    delivery: DeliveryDetail;
    emailConfigured: boolean | undefined;
    defaultMethod: 'email_code' | 'password';
    onAdded: () => void;
}) {
    const toast = useToast();
    const isRequest = delivery.kind === 'request';
    const active = delivery.recipients.filter((r) => !r.removedAt);
    const [draft, setDraft] = useState<RecipientsDraft>(() => emptyRecipients(emailConfigured === false ? 'password' : defaultMethod));
    const [endsAt, setEndsAt] = useState<Date | null>(null);
    const [limit, setLimit] = useState('');
    const [sendInvites, setSendInvites] = useState(emailConfigured !== false);
    const [error, setError] = useState<string | null>(null);
    const [peopleError, setPeopleError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState<RecipientResult[] | null>(null);
    // Focus starts in the field (not "Help me choose" above it) and goes back to the trigger on close
    const peopleInput = useRef<HTMLInputElement>(null);
    const existing = active.map((r) => r.identifier).filter((x): x is string => Boolean(x));

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        let next = draft;
        if (next.pending.trim()) {
            const added = addPeople(next, next.pending, { emailConfigured: emailConfigured !== false, existing });
            next = added.draft;
            setDraft(next);
            if (added.invalid.length) return;
        }
        if (next.people.length === 0 && !next.anyone.enabled) {
            setPeopleError('Add at least one person.');
            return;
        }
        if (limit.trim() && !(/^\d+$/.test(limit.trim()) && Number(limit) >= 1)) {
            setError('Enter a download limit of at least 1, or leave it empty.');
            return;
        }
        setBusy(true);
        try {
            const body = await api<{ recipients: RecipientResult[] }>(`/api/deliveries/${delivery.id}/recipients`, {
                method: 'POST',
                json: {
                    ...toRecipientInputs(next, {
                        endsAt: endsAt ? endsAt.toISOString() : null,
                        downloadLimit: !isRequest && limit.trim() ? Number(limit) : null,
                    }),
                    sendInvites: sendInvites && emailConfigured !== false,
                },
            });
            setResults(body.recipients);
            const people = body.recipients.filter((r) => r.kind === 'person').length;
            toast.success(people ? `Gave access to ${plural(people, 'person', 'people')}` : 'Gave access to anyone with the password');
            onAdded();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    if (results) {
        return (
            <Dialog
                open
                onClose={onClose}
                size="md"
                title={`Added ${plural(results.length, 'person', 'people')}`}
                description="Copy what each person needs. Passwords are shown only this once."
                footer={
                    <Button variant="primary" onClick={onClose}>
                        Done
                    </Button>
                }
            >
                <div className="flex flex-col gap-4">
                    {results.some((r) => r.password) && (
                        <Callout tone="warning" title="Copy the passwords now">
                            They&apos;re never put in an invite email. Send each one on a different channel than the link.
                        </Callout>
                    )}
                    <RecipientResults recipients={results} link={delivery.link} kind={delivery.kind} />
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            open
            onClose={onClose}
            busy={busy}
            size="md"
            initialFocus={peopleInput}
            title="Add people"
            description={`Each person gets their own access to ${delivery.title}.`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" form="add-people-form" loading={busy}>
                        {draft.people.length > 1 ? `Add ${draft.people.length} people` : 'Add people'}
                    </Button>
                </>
            }
        >
            <form id="add-people-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
                <RecipientEditor
                    value={draft}
                    onChange={(value) => {
                        setDraft(value);
                        if (peopleError) setPeopleError(null);
                    }}
                    emailConfigured={emailConfigured}
                    helperVariant="inline"
                    existing={existing}
                    allowAnyone={!active.some((r) => r.kind === 'anyone')}
                    kind={delivery.kind}
                    error={peopleError}
                    inputRef={peopleInput}
                />
                <div className="flex flex-col gap-1.5 border-t border-subtle pt-4">
                    <span className="text-caption font-medium text-secondary">Access ends</span>
                    <DateTimePicker label="Access ends" value={endsAt} onChange={setEndsAt} />
                </div>
                {!isRequest && (
                    <Field label="Download limit" helper="Optional. Downloads per person; Download all counts as one.">
                        <Input type="number" inputMode="numeric" min={1} placeholder="No limit" className="max-w-40" value={limit} onChange={(e) => setLimit(e.target.value)} />
                    </Field>
                )}
                <Switch
                    checked={sendInvites && emailConfigured !== false}
                    onCheckedChange={setSendInvites}
                    disabled={emailConfigured === false}
                    label="Send invites by email"
                    description={
                        emailConfigured === false
                            ? "This Gatekeep can't send email yet, so you'll copy each invite yourself."
                            : 'Passwords are never in the email.'
                    }
                />
                {error && <Callout tone="danger">{error}</Callout>}
            </form>
        </Dialog>
    );
}

/* ------------------------------------------------------------------------------------------ */
/* Change password                                                                             */
/* ------------------------------------------------------------------------------------------ */

export function ChangePasswordDialog({
    deliveryId,
    recipient,
    onClose,
    onChanged,
}: {
    deliveryId: string;
    recipient: Recipient | null;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [result, setResult] = useState<RecipientResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const copy = useCopy();

    if (!recipient) return null;
    const anyone = recipient.kind === 'anyone';
    const name = shortName(recipient.label);
    const close = () => {
        setResult(null);
        setError(null);
        onClose();
    };

    const change = async () => {
        setBusy(true);
        setError(null);
        try {
            const body = await api<{ recipient: RecipientResult }>(`/api/deliveries/${deliveryId}/recipients/${recipient.id}`, {
                method: 'PATCH',
                json: { regeneratePassword: true },
            });
            setResult(body.recipient);
            onChanged();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    if (result?.password) {
        return (
            <Dialog
                open
                onClose={close}
                title={anyone ? 'New password' : `New password for ${name}`}
                footer={
                    <>
                        {!anyone && (
                            <Button variant="secondary" icon={<Copy {...ICON} />} onClick={() => copy(result.inviteText, 'Invite copied')}>
                                Copy invite
                            </Button>
                        )}
                        <Button variant="primary" onClick={close}>
                            Done
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <CopyField label={`New password for ${recipient.label}`} value={result.password} />
                    <Callout tone="warning" title="This is the only time you'll see it">
                        {anyone
                            ? 'Share it with the people who should have access. The old password no longer works.'
                            : `Send it to ${name} separately, by text message, phone or in person. The old password no longer works.`}
                    </Callout>
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            open
            onClose={close}
            busy={busy}
            title={anyone ? 'Change the password for anyone with the password?' : `Change ${possessive(recipient.label)} password?`}
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={change} loading={busy}>
                        Change password
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-body text-secondary">
                    Gatekeep makes a new password and the old one stops working.{' '}
                    {anyone ? 'Anyone who has the delivery open' : `If ${name} has the delivery open, it`} closes, and they need the new password to get back
                    in.
                </p>
                {error && <Callout tone="danger">{error}</Callout>}
            </div>
        </Dialog>
    );
}

/* ------------------------------------------------------------------------------------------ */
/* Change end date or download limit                                                           */
/* ------------------------------------------------------------------------------------------ */

export function ChangeAccessDialog(props: {
    deliveryId: string;
    kind: 'send' | 'request';
    recipient: Recipient | null;
    onClose: () => void;
    onChanged: () => void;
}) {
    // Remount per recipient so the form starts from their current values
    return props.recipient ? <ChangeAccessForm key={props.recipient.id} {...props} recipient={props.recipient} /> : null;
}

function ChangeAccessForm({
    deliveryId,
    kind,
    recipient,
    onClose,
    onChanged,
}: {
    deliveryId: string;
    kind: 'send' | 'request';
    recipient: Recipient;
    onClose: () => void;
    onChanged: () => void;
}) {
    const toast = useToast();
    const ended = recipient.endsAt !== null && new Date(recipient.endsAt).getTime() <= Date.now();
    const [endsAt, setEndsAt] = useState<Date | null>(() =>
        ended ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : recipient.endsAt ? new Date(recipient.endsAt) : null,
    );
    const [limit, setLimit] = useState(recipient.downloadLimit !== null ? String(recipient.downloadLimit) : '');
    const [reset, setReset] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (limit.trim() && !(/^\d+$/.test(limit.trim()) && Number(limit) >= 1)) {
            setError('Enter a download limit of at least 1, or leave it empty.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await api(`/api/deliveries/${deliveryId}/recipients/${recipient.id}`, {
                method: 'PATCH',
                json: {
                    endsAt: endsAt ? endsAt.toISOString() : null,
                    ...(kind === 'send' ? { downloadLimit: limit.trim() ? Number(limit) : null } : {}),
                    ...(reset ? { resetDownloads: true } : {}),
                },
            });
            toast.success(`Updated ${possessive(recipient.label)} access`);
            onChanged();
            onClose();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            busy={busy}
            title={recipient.kind === 'anyone' ? 'Change access for anyone with the password' : `Change ${possessive(recipient.label)} access`}
            description="They stay signed in. The new end date and limit apply right away."
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" form="change-access-form" loading={busy}>
                        Save changes
                    </Button>
                </>
            }
        >
            <form id="change-access-form" noValidate onSubmit={save} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                    <span className="text-caption font-medium text-secondary">Access ends</span>
                    <DateTimePicker label="Access ends" value={endsAt} onChange={setEndsAt} />
                </div>
                {kind === 'send' && (
                    <Field label="Download limit" helper={`Optional. ${plural(recipient.downloadCount, 'download')} so far.`}>
                        <Input type="number" inputMode="numeric" min={1} placeholder="No limit" className="max-w-40" value={limit} onChange={(e) => setLimit(e.target.value)} />
                    </Field>
                )}
                {kind === 'send' && recipient.downloadCount > 0 && (
                    <Checkbox
                        checked={reset}
                        onChange={(e) => setReset(e.target.checked)}
                        label="Reset their download count"
                        description="Start counting downloads from zero again."
                    />
                )}
                {error && <Callout tone="danger">{error}</Callout>}
            </form>
        </Dialog>
    );
}

/* ------------------------------------------------------------------------------------------ */
/* Edit details                                                                                */
/* ------------------------------------------------------------------------------------------ */

export function EditDetailsDialog({ open, onClose, delivery, onSaved }: { open: boolean; onClose: () => void; delivery: DeliveryDetail; onSaved: () => void }) {
    return open ? <EditDetailsForm onClose={onClose} delivery={delivery} onSaved={onSaved} /> : null;
}

function EditDetailsForm({ onClose, delivery, onSaved }: { onClose: () => void; delivery: DeliveryDetail; onSaved: () => void }) {
    const toast = useToast();
    const [title, setTitle] = useState(delivery.title);
    const [message, setMessage] = useState(delivery.message ?? '');
    const [error, setError] = useState<string | null>(null);
    const [titleError, setTitleError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) {
            setTitleError(`Give the ${delivery.kind === 'request' ? 'request' : 'delivery'} a title.`);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await api(`/api/deliveries/${delivery.id}`, { method: 'PATCH', json: { title: title.trim(), message: message.trim() } });
            toast.success('Details saved');
            onSaved();
            onClose();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            busy={busy}
            title="Edit details"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" form="edit-details-form" loading={busy}>
                        Save changes
                    </Button>
                </>
            }
        >
            <form id="edit-details-form" noValidate onSubmit={save} className="flex flex-col gap-5">
                <Field label="Title" error={titleError}>
                    <Input
                        value={title}
                        maxLength={200}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            setTitleError(null);
                        }}
                    />
                </Field>
                <Field label="Message" helper="Optional. Shown to people when they open the link.">
                    <Textarea value={message} maxLength={2000} rows={4} onChange={(e) => setMessage(e.target.value)} />
                </Field>
                {error && <Callout tone="danger">{error}</Callout>}
            </form>
        </Dialog>
    );
}

/* ------------------------------------------------------------------------------------------ */
/* Add files                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export function AddFilesDialog({ open, onClose, delivery, onSaved }: { open: boolean; onClose: () => void; delivery: DeliveryDetail; onSaved: () => void }) {
    return open ? <AddFilesForm onClose={onClose} delivery={delivery} onSaved={onSaved} /> : null;
}

function AddFilesForm({ onClose, delivery, onSaved }: { onClose: () => void; delivery: DeliveryDetail; onSaved: () => void }) {
    const toast = useToast();
    const [selected, setSelected] = useState<LibraryFile[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        if (selected.length === 0) {
            setError('Choose at least one file to add.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await api(`/api/deliveries/${delivery.id}`, {
                method: 'PATCH',
                json: { fileIds: [...delivery.files.map((f) => f.id), ...selected.map((f) => f.id)] },
            });
            toast.success(`Added ${plural(selected.length, 'file')}`);
            onSaved();
            onClose();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            busy={busy}
            size="md"
            title="Add files"
            description="People on this delivery see new files the next time they open it."
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={save} loading={busy}>
                        {selected.length ? `Add ${plural(selected.length, 'file')}` : 'Add files'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <FilePicker selected={selected} onChange={setSelected} exclude={delivery.files.map((f) => f.id)} />
                {error && <Callout tone="danger">{error}</Callout>}
            </div>
        </Dialog>
    );
}
