/**
 * Every email Gatekeep sends, written to docs/VOICE.md. Builders are pure: they take the facts
 * and return subject + HTML + text. None of them ever contains a password.
 */
import { renderEmail } from './template';
import { env } from '@/lib/env';
import { formatDateTime, plural } from '@/lib/deliveries/format';
import type { AccessMethod, DeliveryKind } from '@/lib/types';

export interface BuiltEmail {
    subject: string;
    html: string;
    text: string;
}

/** The person the email is from (recipient emails) or about (owner emails). */
export interface Sender {
    /** "Avery Stone" */
    name: string;
    /** "Avery Stone from Northwind Studio" */
    label: string;
    logoUrl?: string | null;
}

interface Content {
    preheader: string;
    heading: string;
    paragraphs?: string[];
    quote?: { from: string; text: string };
    rows?: { label: string; value: string }[];
    code?: string;
    button?: { label: string; url: string };
    /** Small print after the main content */
    after?: string[];
    footer?: string[];
}

/** Render with the Gatekeep Mono email layout (lib/email/template.ts). */
function build(subject: string, content: Content): BuiltEmail {
    return {
        subject,
        ...renderEmail({
            appUrl: env.app.url,
            preheader: content.preheader,
            heading: content.heading,
            paragraphs: content.paragraphs,
            quote: content.quote ? { text: content.quote.text, attribution: `— ${content.quote.from}` } : undefined,
            rows: content.rows?.map((row) => [row.label, row.value] as [string, string]),
            code: content.code,
            button: content.button,
            note: content.after?.length ? content.after.join('\n\n') : undefined,
            footer: content.footer,
        }),
    };
}

function quoteTitle(title: string): string {
    const clean = title.replace(/\s+/g, ' ').trim();
    return `"${clean.length > 60 ? `${clean.slice(0, 57)}…` : clean}"`;
}

function filesValue(fileNames: string[]): string {
    if (fileNames.length === 0) return '—';
    const shown = fileNames.slice(0, 5).join(', ');
    return fileNames.length > 5 ? `${shown} and ${fileNames.length - 5} more` : shown;
}

const recipientFooter = (sender: Sender) => [
    `Sent with Gatekeep on behalf of ${sender.label}.`,
    `Questions? Reply to this email to reach ${sender.name}.`,
];

// ---------------------------------------------------------------------------
// Recipient emails
// ---------------------------------------------------------------------------

export function inviteEmail(input: {
    sender: Sender;
    kind: DeliveryKind;
    title: string;
    message: string | null;
    fileNames: string[];
    url: string;
    method: AccessMethod;
    recipientEmail: string;
    endsAt: string | null;
    downloadLimit: number | null;
}): BuiltEmail {
    const { sender } = input;
    const isRequest = input.kind === 'request';
    const verify =
        input.method === 'email_code'
            ? `When you open it, we'll send a 6-digit code to ${input.recipientEmail} to confirm it's you.`
            : `You'll need the password ${sender.name} gives you. It isn't in this email.`;

    const rows: { label: string; value: string }[] = [];
    if (!isRequest) rows.push({ label: input.fileNames.length === 1 ? 'File' : 'Files', value: filesValue(input.fileNames) });
    if (input.endsAt) rows.push({ label: 'Access ends', value: formatDateTime(input.endsAt) });
    if (input.downloadLimit && !isRequest) rows.push({ label: 'Downloads', value: plural(input.downloadLimit, 'download') });

    const subject = isRequest
        ? `${sender.name} asked you to upload files`
        : `${sender.name} sent you ${quoteTitle(input.title)}`;

    return build(subject, {
        preheader: isRequest
            ? `Upload them securely to ${sender.name}. ${input.method === 'email_code' ? "You'll confirm your email with a code." : "You'll need the password they give you."}`
            : `${plural(input.fileNames.length, 'file')} from ${sender.label}. ${input.method === 'email_code' ? "You'll confirm your email with a code." : "You'll need the password they give you."}`,
        heading: isRequest ? `${sender.name} asked you to upload files` : `${sender.name} sent you files`,
        paragraphs: [`${input.title}`],
        quote: input.message ? { from: sender.name, text: input.message } : undefined,
        rows,
        button: { label: isRequest ? 'Upload files' : 'Open delivery', url: input.url },
        after: [verify, "If you weren't expecting this, you can ignore this email."],
        footer: recipientFooter(sender),
    });
}

export function codeEmail(input: { sender: Sender; title: string; code: string }): BuiltEmail {
    return build(`${input.code} is your code for ${quoteTitle(input.title)}`, {
        preheader: 'Enter it to open the delivery. It works once and expires in 10 minutes.',
        heading: `Your code for ${input.title}`,
        paragraphs: [`Enter this code to open the delivery from ${input.sender.label}:`],
        code: input.code,
        after: [
            "The code works once and expires in 10 minutes. If you didn't try to open this delivery, you can ignore this email. Nobody can get in without the code.",
        ],
        footer: [`Sent with Gatekeep on behalf of ${input.sender.label}.`],
    });
}

export function accessEndingEmail(input: { sender: Sender; title: string; url: string; endsAt: string }): BuiltEmail {
    const when = formatDateTime(input.endsAt);
    return build(`Your access to ${quoteTitle(input.title)} ends soon`, {
        preheader: `Download what you need before ${when}.`,
        heading: `Your access ends ${when}`,
        paragraphs: [`Your access to ${input.title} from ${input.sender.label} ends on ${when}.`],
        button: { label: 'Open delivery', url: input.url },
        after: [`Need more time? Reply to this email to ask ${input.sender.name}.`],
        footer: recipientFooter(input.sender),
    });
}

export function accessRemovedEmail(input: { sender: Sender; title: string }): BuiltEmail {
    return build(`${input.sender.name} stopped sharing ${quoteTitle(input.title)}`, {
        preheader: "The link won't open for you anymore.",
        heading: `${input.sender.name} stopped sharing ${input.title}`,
        paragraphs: [`${input.sender.label} removed your access. The link won't open for you anymore.`],
        after: [`If you think this is a mistake, reply to this email to reach ${input.sender.name}.`],
        footer: [`Sent with Gatekeep on behalf of ${input.sender.label}.`],
    });
}

// ---------------------------------------------------------------------------
// Owner emails
// ---------------------------------------------------------------------------

const ownerFooter = (settingsUrl: string) => [
    `You get this because notifications are on for your Gatekeep. Change them in Settings → Notifications: ${settingsUrl}`,
];

export function openedEmail(input: {
    actor: string;
    title: string;
    at: string;
    ip: string | null;
    downloads: { used: number; limit: number | null } | null;
    activityUrl: string;
    settingsUrl: string;
}): BuiltEmail {
    const rows = [{ label: 'When', value: formatDateTime(input.at) }];
    if (input.ip) rows.push({ label: 'From', value: input.ip });
    if (input.downloads)
        rows.push({
            label: 'Downloads',
            value: input.downloads.limit ? `${input.downloads.used} of ${input.downloads.limit}` : String(input.downloads.used),
        });
    return build(`${input.actor} opened ${quoteTitle(input.title)}`, {
        preheader: `${formatDateTime(input.at)}${input.ip ? ` · from ${input.ip}` : ''}`,
        heading: `${input.actor} opened ${input.title}`,
        rows,
        button: { label: 'See activity', url: input.activityUrl },
        after: ["You get this the first time each person opens a delivery in a day. If you didn't expect it, you can remove their access from the delivery."],
        footer: ownerFooter(input.settingsUrl),
    });
}

export function downloadedEmail(input: {
    actor: string;
    title: string;
    fileName: string | null;
    at: string;
    downloads: { used: number; limit: number | null };
    activityUrl: string;
    settingsUrl: string;
}): BuiltEmail {
    const what = input.fileName ?? 'all files';
    return build(`${input.actor} downloaded ${input.fileName ? quoteTitle(input.fileName) : `everything in ${quoteTitle(input.title)}`}`, {
        preheader: `${formatDateTime(input.at)} · ${input.downloads.limit ? `${input.downloads.used} of ${input.downloads.limit} downloads used` : plural(input.downloads.used, 'download')}`,
        heading: `${input.actor} downloaded ${input.fileName ? `${input.fileName}` : 'all files'}`,
        rows: [
            { label: 'Delivery', value: input.title },
            { label: 'Downloaded', value: what },
            { label: 'When', value: formatDateTime(input.at) },
            {
                label: 'Downloads used',
                value: input.downloads.limit ? `${input.downloads.used} of ${input.downloads.limit}` : String(input.downloads.used),
            },
        ],
        button: { label: 'See activity', url: input.activityUrl },
        footer: ownerFooter(input.settingsUrl),
    });
}

export function deniedEmail(input: {
    title: string;
    count: number;
    minutes: number;
    reasons: string[];
    ips: string[];
    activityUrl: string;
    settingsUrl: string;
}): BuiltEmail {
    return build(`${plural(input.count, 'denied attempt')} on ${quoteTitle(input.title)}`, {
        preheader: `In the last ${input.minutes} minutes. Repeated wrong attempts are throttled automatically.`,
        heading: `Someone was denied access to ${input.title}`,
        paragraphs: [
            `There were ${plural(input.count, 'denied attempt')} in the last ${input.minutes} minutes. Gatekeep throttles repeated attempts automatically, and people who already have access aren't affected.`,
        ],
        rows: [
            { label: 'Reasons', value: input.reasons.join(', ') || '—' },
            { label: 'From', value: input.ips.slice(0, 5).join(', ') || 'Unknown' },
        ],
        button: { label: 'Review activity', url: input.activityUrl },
        after: ["If this wasn't you or someone you shared with, change the password or remove access."],
        footer: ownerFooter(input.settingsUrl),
    });
}

export function uploadedEmail(input: {
    actor: string;
    title: string;
    fileNames: string[];
    folderName: string | null;
    filesUrl: string;
    settingsUrl: string;
}): BuiltEmail {
    return build(`${input.actor} uploaded ${plural(input.fileNames.length, 'file')} to ${quoteTitle(input.title)}`, {
        preheader: filesValue(input.fileNames),
        heading: `${input.actor} uploaded ${plural(input.fileNames.length, 'file')}`,
        rows: [
            { label: 'Request', value: input.title },
            { label: input.fileNames.length === 1 ? 'File' : 'Files', value: filesValue(input.fileNames) },
            { label: 'Saved to', value: input.folderName ?? 'All files' },
        ],
        button: { label: 'Open files', url: input.filesUrl },
        footer: ownerFooter(input.settingsUrl),
    });
}

export function passwordResetEmail(input: { email: string; instanceUrl: string; resetUrl: string }): BuiltEmail {
    return build('Reset your Gatekeep password', {
        preheader: 'This link works once and expires in 1 hour.',
        heading: 'Reset your password',
        paragraphs: [`Someone asked to reset the password for ${input.email} on ${input.instanceUrl}.`],
        button: { label: 'Choose a new password', url: input.resetUrl },
        after: ["The link works once and expires in 1 hour. If you didn't ask for this, ignore this email. Your password won't change."],
        footer: ['Sent by your Gatekeep.'],
    });
}
