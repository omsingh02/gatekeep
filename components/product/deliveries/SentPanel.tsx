'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import { Badge, Button, Callout, Card, CopyField, StatusPill, useToast } from '@/components/ds';
import type { DeliveryKind, RecipientResult } from './api';
import { PersonAvatar } from './PersonAvatar';
import { ANYONE_LABEL, METHOD_LABELS, plural, shortDate, shortName } from './format';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

export function useCopy() {
    const toast = useToast();
    return async (text: string, done: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(done);
        } catch {
            toast.error("Couldn't copy. Select the text and copy it yourself.");
        }
    };
}

/**
 * Each new recipient with how they get in: "Invite sent" or "Copy invite", and for passwords the
 * password, shown this one time, with a reminder that it isn't in the email.
 */
export function RecipientResults({ recipients, link, kind = 'send' }: { recipients: RecipientResult[]; link: string; kind?: DeliveryKind }) {
    const copy = useCopy();
    const verb = kind === 'request' ? 'upload' : 'open it';
    return (
        <ul className="divide-y divide-gray-4" aria-label="People and how they get in">
            {recipients.map((r) => {
                const anyone = r.kind === 'anyone';
                return (
                    <li key={r.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" data-testid="sent-recipient">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
                                <PersonAvatar label={r.label} />
                                <div className="min-w-0">
                                    <p className="truncate text-body text-primary">{r.label}</p>
                                    <p className="text-caption text-tertiary">
                                        {METHOD_LABELS[r.method]}
                                        {r.endsAt ? ` · ends ${shortDate(r.endsAt)}` : ''}
                                        {r.downloadLimit !== null ? ` · ${plural(r.downloadLimit, 'download')}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 max-sm:w-full max-sm:pl-8">
                                {r.inviteSent ? (
                                    <StatusPill tone="success">Invite sent</StatusPill>
                                ) : !anyone ? (
                                    <Badge>Not emailed</Badge>
                                ) : null}
                                {anyone ? (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        icon={<Copy {...ICON} />}
                                        onClick={() => copy(`${link}\nPassword: ${r.password ?? ''}`, 'Link and password copied')}
                                    >
                                        Copy link and password
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant={r.inviteSent ? 'ghost' : 'secondary'}
                                        icon={<Copy {...ICON} />}
                                        onClick={() => copy(r.inviteText, 'Invite copied')}
                                    >
                                        Copy invite
                                    </Button>
                                )}
                            </div>
                        </div>
                        {r.password && (
                            <div className="flex flex-col gap-1.5 pl-8">
                                <p className="text-caption font-medium text-secondary">
                                    {anyone ? 'Password' : `Password for ${shortName(r.label)}`}
                                </p>
                                <CopyField label={anyone ? `Password for ${ANYONE_LABEL.toLowerCase()}` : `Password for ${r.label}`} value={r.password} className="max-w-80" />
                                <p className="text-caption text-tertiary">
                                    {anyone
                                        ? `Share it only with the people who should ${verb}.`
                                        : r.inviteSent
                                          ? `It isn't in the email. Send it separately, by text message, phone or in person.`
                                          : `It isn't in the invite. Send it separately, by text message, phone or in person.`}
                                </p>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

export interface SentPanelProps {
    kind: DeliveryKind;
    title: string;
    link: string;
    recipients: RecipientResult[];
    actions?: ReactNode;
}

/** Shown once a delivery or request is created: the link, every person, and passwords once. */
export function SentPanel({ kind, title, link, recipients, actions }: SentPanelProps) {
    const copy = useCopy();
    const people = recipients.filter((r) => r.kind === 'person');
    const emailed = people.filter((r) => r.inviteSent).length;
    const hasPasswords = recipients.some((r) => r.password);
    const noun = kind === 'request' ? 'Request' : 'Delivery';
    const heading = emailed > 0 ? `${noun} sent to ${plural(people.length, 'person', 'people')}` : `${noun} created`;

    return (
        <Card flush className="mx-auto w-full max-w-[760px]" data-testid="sent-panel">
            <div className="flex flex-col gap-4 border-b border-subtle px-4 py-5 sm:px-6">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-success-border bg-success-bg text-success">
                        <CheckCircle2 aria-hidden strokeWidth={1.75} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-h2 text-strong">{heading}</h2>
                        <p className="mt-0.5 text-body-sm text-secondary">
                            <span className="text-primary">{title}</span>
                            {' · '}
                            {emailed === people.length && people.length > 0
                                ? 'Everyone has an invite in their inbox.'
                                : emailed > 0
                                  ? 'Copy the invites that weren’t emailed and send them yourself.'
                                  : 'Copy each invite and send it yourself.'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-caption font-medium text-secondary">Link</span>
                    <div className="flex gap-2">
                        <CopyField label={`${noun} link`} value={link} />
                        <Button variant="secondary" className="max-sm:hidden" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}>
                            Open
                        </Button>
                    </div>
                    <p className="text-caption text-tertiary">
                        {kind === 'request' ? 'Only the people below can upload through it.' : 'Only the people below can open it.'}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
                {hasPasswords && (
                    <Callout tone="warning" title="Copy the passwords now">
                        Passwords are shown only this once and are never put in an invite email. Send each one on a different channel than the link.
                    </Callout>
                )}
                <RecipientResults recipients={recipients} link={link} kind={kind} />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-subtle px-4 py-3 sm:flex-row sm:justify-between sm:px-6">
                <Button variant="ghost" icon={<Copy {...ICON} />} onClick={() => copy(link, 'Link copied')}>
                    Copy link
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">{actions}</div>
            </div>
        </Card>
    );
}
