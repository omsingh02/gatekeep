'use client';

import { useState, type ClipboardEvent, type KeyboardEvent, type Ref } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { Avatar, Button, Callout, CopyField, Field, IconButton, Input, SegmentedControl, Switch, cn } from '@/components/ds';
import { AccessMethodHelper } from '@/components/product/AccessMethodHelper';
import { readablePassword, type AccessMethod, type AnyoneInput, type PersonInput } from './api';
import { METHOD_LABELS, parsePeople, plural } from './format';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

export interface PersonDraft {
    key: string;
    identifier: string;
    identifierType: 'email' | 'username';
    method: AccessMethod;
    /** Generated up front so it can be shown and copied before sending; only sent for passwords */
    password: string;
}

export interface RecipientsDraft {
    people: PersonDraft[];
    anyone: { enabled: boolean; password: string };
    /** Text typed into the input but not added yet (added on submit) */
    pending: string;
    /** Method for new email addresses */
    preferred: AccessMethod;
}

export function emptyRecipients(preferred: AccessMethod = 'email_code'): RecipientsDraft {
    return { people: [], anyone: { enabled: false, password: readablePassword() }, pending: '', preferred };
}

let keySeq = 0;

/** Add everything in `text` to the list. Returns what couldn't be added so it can be explained. */
export function addPeople(
    draft: RecipientsDraft,
    text: string,
    options: { emailConfigured: boolean; existing?: string[] },
): { draft: RecipientsDraft; invalid: string[]; duplicates: string[] } {
    const { valid, invalid } = parsePeople(text);
    const taken = new Set([...draft.people.map((p) => p.identifier), ...(options.existing ?? [])]);
    const duplicates: string[] = [];
    const added: PersonDraft[] = [];
    for (const person of valid) {
        if (taken.has(person.identifier)) {
            duplicates.push(person.identifier);
            continue;
        }
        taken.add(person.identifier);
        added.push({
            key: `p${++keySeq}`,
            ...person,
            method: person.identifierType === 'username' || !options.emailConfigured ? 'password' : draft.preferred,
            password: readablePassword(),
        });
    }
    return { draft: { ...draft, people: [...draft.people, ...added], pending: invalid.join(', ') }, invalid, duplicates };
}

/** The request body parts for POST /api/deliveries (people + anyone), with shared end date and limit. */
export function toRecipientInputs(
    draft: RecipientsDraft,
    access: { endsAt: string | null; downloadLimit: number | null },
): { people: PersonInput[]; anyone?: AnyoneInput } {
    return {
        people: draft.people.map((p) => ({
            identifier: p.identifier,
            identifierType: p.identifierType,
            method: p.method,
            ...(p.method === 'password' ? { password: p.password } : {}),
            endsAt: access.endsAt,
            downloadLimit: access.downloadLimit,
        })),
        ...(draft.anyone.enabled ? { anyone: { password: draft.anyone.password, ...access } } : {}),
    };
}

export interface RecipientEditorProps {
    value: RecipientsDraft;
    onChange: (next: RecipientsDraft) => void;
    /** From GET /api/status. Undefined while it loads. */
    emailConfigured: boolean | undefined;
    /** `dialog` opens the helper in a dialog; `inline` expands it in place (use inside dialogs: no nesting) */
    helperVariant?: 'dialog' | 'inline';
    /** People already on the delivery, so they aren't added twice */
    existing?: string[];
    /** Hide the "Anyone with the password" option (e.g. it's already on the delivery) */
    allowAnyone?: boolean;
    kind?: 'send' | 'request';
    error?: string | null;
    /** The "Add people" field, e.g. for a dialog's initialFocus */
    inputRef?: Ref<HTMLInputElement>;
}

/**
 * Add people by email (email code by default) or username (always a password). Each person gets
 * their own access and, with passwords, their own generated password. Paste a list to add many.
 */
export function RecipientEditor({
    value,
    onChange,
    emailConfigured,
    helperVariant = 'dialog',
    existing,
    allowAnyone = true,
    kind = 'send',
    error,
    inputRef,
}: RecipientEditorProps) {
    const [inputError, setInputError] = useState<string | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [helperOpen, setHelperOpen] = useState(false);
    const canEmail = emailConfigured !== false;

    const commit = (text: string) => {
        if (!text.trim()) return;
        const result = addPeople(value, text, { emailConfigured: canEmail, existing });
        onChange(result.draft);
        setInputError(
            result.invalid.length
                ? result.invalid.length === 1
                    ? result.invalid[0].includes('@')
                        ? `“${result.invalid[0]}” isn't a valid email address.`
                        : `“${result.invalid[0]}” isn't a valid email address or username.`
                    : `${result.invalid.length} entries aren't valid email addresses or usernames. Check them and add them again.`
                : null,
        );
        const added = result.draft.people.length - value.people.length;
        setNote(
            result.duplicates.length
                ? `${result.duplicates.join(', ')} ${result.duplicates.length === 1 ? 'is' : 'are'} already on the list.`
                : added > 1
                  ? `Added ${plural(added, 'person', 'people')}.`
                  : null,
        );
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
            event.preventDefault();
            commit(value.pending);
        }
    };

    const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const pasted = event.clipboardData.getData('text');
        if (/[\s,;]/.test(pasted.trim())) {
            event.preventDefault();
            commit(`${value.pending} ${pasted}`);
        }
    };

    const update = (key: string, patch: Partial<PersonDraft>) =>
        onChange({ ...value, people: value.people.map((p) => (p.key === key ? { ...p, ...patch } : p)) });

    const apply = (method: AccessMethod) => {
        onChange({
            ...value,
            preferred: method,
            people: value.people.map((p) => (p.identifierType === 'email' ? { ...p, method } : p)),
        });
        setHelperOpen(false);
        setNote(
            method === 'email_code'
                ? 'Everyone with an email address will get an email code.'
                : 'Everyone will get their own password.',
        );
    };

    const verb = kind === 'request' ? 'upload' : 'open it';
    const codes = value.people.filter((p) => p.method === 'email_code').length;
    const passwords = value.people.length - codes;

    return (
        <div className="flex flex-col gap-4">
            {emailConfigured === false && (
                <Callout title="Everyone gets a password">
                    This Gatekeep can&apos;t send email yet, so email codes aren&apos;t available. Set up email in Settings → System status to use
                    them.
                </Callout>
            )}

            <Field
                label="Add people"
                helper={inputError ? undefined : 'Email addresses or usernames. Paste a list to add several at once.'}
                error={inputError ?? (value.people.length === 0 ? error : null)}
                labelAction={
                    helperVariant === 'dialog' ? (
                        <AccessMethodHelper variant="dialog" emailConfigured={emailConfigured} onApply={apply} />
                    ) : (
                        <Button
                            variant="link"
                            size="sm"
                            className="text-caption font-medium text-secondary"
                            aria-expanded={helperOpen}
                            onClick={() => setHelperOpen((o) => !o)}
                        >
                            Help me choose
                        </Button>
                    )
                }
            >
                <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                        <Input
                            ref={inputRef}
                            value={value.pending}
                            onChange={(event) => {
                                onChange({ ...value, pending: event.target.value });
                                if (inputError) setInputError(null);
                            }}
                            onKeyDown={onKeyDown}
                            onPaste={onPaste}
                            onBlur={() => commit(value.pending)}
                            placeholder="maya@northwind.com, j.chen"
                            autoComplete="off"
                            spellCheck={false}
                            inputMode="email"
                        />
                    </div>
                    <Button variant="secondary" icon={<Plus {...ICON} />} onClick={() => commit(value.pending)} disabled={!value.pending.trim()}>
                        Add
                    </Button>
                </div>
            </Field>

            {helperVariant === 'inline' && helperOpen && (
                <AccessMethodHelper variant="inline" emailConfigured={emailConfigured} onApply={apply} onClose={() => setHelperOpen(false)} />
            )}

            <p className="sr-only" aria-live="polite">
                {note}
            </p>
            {note && <p className="-mt-2 text-caption text-tertiary">{note}</p>}

            {value.people.length > 0 && (
                <div className="flex flex-col gap-2">
                    <ul className="divide-y divide-gray-4 rounded-lg border border-default bg-surface" aria-label="People on this delivery">
                        {value.people.map((person) => {
                            const codeDisabled = person.identifierType === 'username' || !canEmail;
                            return (
                                <li key={person.key} className="flex flex-col gap-2.5 px-3 py-2.5">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                        <div className="flex min-w-0 flex-1 basis-52 items-center gap-2.5">
                                            <Avatar name={person.identifier} size="sm" />
                                            <div className="min-w-0">
                                                <p className="truncate text-body text-primary">{person.identifier}</p>
                                                <p className="text-caption text-tertiary">
                                                    {person.identifierType === 'email'
                                                        ? person.method === 'email_code'
                                                            ? `Gets a code at this address when they ${verb}`
                                                            : 'Email address · signs in with a password'
                                                        : 'Username · signs in with a password'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-between max-sm:pl-8">
                                            <SegmentedControl
                                                size="sm"
                                                label={`Access method for ${person.identifier}`}
                                                value={person.method}
                                                onChange={(method) => update(person.key, { method })}
                                                options={[
                                                    { value: 'email_code', label: METHOD_LABELS.email_code, disabled: codeDisabled },
                                                    { value: 'password', label: METHOD_LABELS.password },
                                                ]}
                                            />
                                            <IconButton
                                                label={`Remove ${person.identifier}`}
                                                size="sm"
                                                icon={<X {...ICON} />}
                                                onClick={() => onChange({ ...value, people: value.people.filter((p) => p.key !== person.key) })}
                                            />
                                        </div>
                                    </div>
                                    {person.method === 'password' && (
                                        <div className="flex items-center gap-1.5 pl-8">
                                            <CopyField label={`Password for ${person.identifier}`} value={person.password} className="max-w-72" />
                                            <IconButton
                                                label={`Generate a new password for ${person.identifier}`}
                                                size="sm"
                                                icon={<RefreshCw {...ICON} />}
                                                onClick={() => update(person.key, { password: readablePassword() })}
                                            />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <p className="text-caption text-tertiary">
                        {plural(value.people.length, 'person', 'people')}
                        {codes > 0 && passwords > 0 && ` · ${codes} with an email code, ${passwords} with a password`}
                        {passwords > 0 && ' · each password is their own'}
                    </p>
                </div>
            )}

            {allowAnyone && (
                <div className={cn('rounded-lg border border-default bg-surface px-3 py-3', value.anyone.enabled && 'flex flex-col gap-3')}>
                    <Switch
                        checked={value.anyone.enabled}
                        onCheckedChange={(enabled) => onChange({ ...value, anyone: { ...value.anyone, enabled } })}
                        label="Anyone with the password"
                        description={
                            kind === 'request'
                                ? "Also let people you don't name upload with one password."
                                : "Also let people you don't name open it with one password. Their activity isn't tied to a person."
                        }
                    />
                    {value.anyone.enabled && (
                        <div className="flex items-center gap-1.5">
                            <CopyField label="Password for anyone with the password" value={value.anyone.password} className="max-w-72" />
                            <IconButton
                                label="Generate a new password for anyone with the password"
                                size="sm"
                                icon={<RefreshCw {...ICON} />}
                                onClick={() => onChange({ ...value, anyone: { ...value.anyone, password: readablePassword() } })}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
