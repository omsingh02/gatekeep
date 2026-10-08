import { createAdminClient } from '@/lib/supabase/admin';
import { emailConfigured } from '@/lib/email/transport';
import { hashPassword } from '@/lib/utils/crypto';
import { sanitizeShortCode, sanitizeUserIdentifier } from '@/lib/utils/sanitization';
import type { AccessMethod, Database, IdentifierType, Tables } from '@/lib/types';
import { generateReadablePassword } from './codes';
import { deliveryUrl } from './format';
import { ANYONE_LABEL } from './labels';
import type { OwnerSettings } from './settings';

export type Delivery = Tables<'deliveries'>;
export type Recipient = Tables<'delivery_recipients'>;
type RecipientInsert = Database['public']['Tables']['delivery_recipients']['Insert'];

/** A live delivery by its link code. v1 links that predate the upgrade are converted on first use. */
export async function loadDeliveryByCode(code: string): Promise<Delivery | null> {
    const clean = sanitizeShortCode(code);
    if (!clean || clean !== code) return null;
    const admin = createAdminClient();
    const find = () => admin.from('deliveries').select('*').eq('short_code', clean).is('deleted_at', null).maybeSingle();

    const { data } = await find();
    if (data) return data;

    // A link the 1.x dashboard created after the upgrade migration ran (before 2.0 was deployed):
    // convert it now. Only v1 files have a short code; files uploaded since 2.0 don't.
    const { data: legacyFile } = await admin
        .from('files')
        .select('id')
        .eq('short_code', clean)
        .is('deleted_at', null)
        .maybeSingle();
    if (!legacyFile) return null;
    await admin.rpc('migrate_v1_to_v2');
    return (await find()).data;
}

// ---------------------------------------------------------------------------
// Access state
// ---------------------------------------------------------------------------

export type AccessProblem = 'removed' | 'ended' | 'download_limit';

export function accessProblem(
    recipient: Pick<Recipient, 'removed_at' | 'ends_at' | 'download_limit' | 'download_count'>,
    options: { forDownload?: boolean } = {},
    now = Date.now(),
): AccessProblem | null {
    if (recipient.removed_at) return 'removed';
    if (recipient.ends_at && new Date(recipient.ends_at).getTime() <= now) return 'ended';
    if (options.forDownload && recipient.download_limit !== null && recipient.download_count >= recipient.download_limit) {
        return 'download_limit';
    }
    return null;
}

export type RecipientStatus = 'active' | 'ended' | 'limit_reached' | 'removed';

export function recipientStatus(recipient: Recipient, now = Date.now()): RecipientStatus {
    if (recipient.removed_at) return 'removed';
    if (recipient.ends_at && new Date(recipient.ends_at).getTime() <= now) return 'ended';
    if (recipient.download_limit !== null && recipient.download_count >= recipient.download_limit) return 'limit_reached';
    return 'active';
}

export function recipientLabel(recipient: Pick<Recipient, 'kind' | 'identifier'>): string {
    return recipient.kind === 'anyone' ? ANYONE_LABEL : (recipient.identifier ?? '');
}

/** API shape for the owner. Never includes hashes or session data. */
export function serializeRecipient(recipient: Recipient) {
    return {
        id: recipient.id,
        kind: recipient.kind,
        label: recipientLabel(recipient),
        identifier: recipient.identifier,
        identifierType: recipient.identifier_type,
        method: recipient.method,
        endsAt: recipient.ends_at,
        downloadLimit: recipient.download_limit,
        downloadCount: recipient.download_count,
        openCount: recipient.open_count,
        lastOpenedAt: recipient.last_opened_at,
        removedAt: recipient.removed_at,
        status: recipientStatus(recipient),
        createdAt: recipient.created_at,
    };
}

export function serializeDeliverySummary(delivery: Delivery) {
    return {
        id: delivery.id,
        kind: delivery.kind,
        title: delivery.title,
        message: delivery.message,
        shortCode: delivery.short_code,
        link: deliveryUrl(delivery.short_code),
        request:
            delivery.kind === 'request'
                ? {
                      folderId: delivery.request_folder_id,
                      maxFiles: delivery.request_max_files,
                      maxFileMb: delivery.request_max_file_mb,
                  }
                : null,
        createdAt: delivery.created_at,
        updatedAt: delivery.updated_at,
    };
}

// ---------------------------------------------------------------------------
// Input parsing (owner)
// ---------------------------------------------------------------------------

export interface RecipientInput {
    identifier?: unknown;
    identifierType?: unknown;
    method?: unknown;
    password?: unknown;
    endsAt?: unknown;
    downloadLimit?: unknown;
}

export interface ParsedRecipient {
    row: Omit<RecipientInsert, 'delivery_id'>;
    /** The password to show the owner once (generated or as typed); null for email codes */
    password: string | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseEndsAt(value: unknown, fallbackDays: number | null): Parsed<string | null> {
    if (value === undefined) {
        return { ok: true, value: fallbackDays ? new Date(Date.now() + fallbackDays * 86400000).toISOString() : null };
    }
    if (value === null || value === '') return { ok: true, value: null };
    const t = new Date(String(value)).getTime();
    if (Number.isNaN(t)) return { ok: false, error: "That end date isn't valid." };
    if (t <= Date.now()) return { ok: false, error: 'Pick an end date in the future.' };
    return { ok: true, value: new Date(t).toISOString() };
}

export function parseDownloadLimit(value: unknown, fallback: number | null): Parsed<number | null> {
    if (value === undefined) return { ok: true, value: fallback };
    if (value === null || value === '' || value === 0) return { ok: true, value: null };
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'The download limit must be a whole number of at least 1.' };
    return { ok: true, value: n };
}

function parsePassword(value: unknown): Parsed<string> {
    if (value === undefined || value === null || value === '') return { ok: true, value: generateReadablePassword() };
    if (typeof value !== 'string' || value.length < 8) return { ok: false, error: 'Use a password of at least 8 characters.' };
    if (value.length > 200) return { ok: false, error: 'Use a password of at most 200 characters.' };
    return { ok: true, value };
}

export const NO_EMAIL_FOR_CODES =
    "This Gatekeep can't send email yet, so email codes aren't available. Use a password, or set up email (see Settings → System status).";

/** Validate one person and turn it into a row. Each person gets their own password. */
export async function parsePersonRecipient(input: RecipientInput, settings: OwnerSettings): Promise<Parsed<ParsedRecipient>> {
    const raw = typeof input.identifier === 'string' ? input.identifier : '';
    const looksLikeEmail = raw.includes('@');
    const identifierType: IdentifierType =
        input.identifierType === 'email' || input.identifierType === 'username'
            ? input.identifierType
            : looksLikeEmail
              ? 'email'
              : 'username';
    const identifier = sanitizeUserIdentifier(raw);
    if (!identifier) {
        return { ok: false, error: identifierType === 'email' ? `"${raw}" isn't a valid email address.` : 'Enter an email address or username.' };
    }
    if (identifierType === 'email' && !identifier.includes('@')) return { ok: false, error: `"${raw}" isn't a valid email address.` };
    if (identifierType === 'username' && identifier.includes('@')) {
        return { ok: false, error: 'Usernames can’t contain @. Choose "Email" for email addresses.' };
    }

    let method: AccessMethod;
    if (input.method === 'email_code' || input.method === 'password') method = input.method;
    else method = identifierType === 'email' && emailConfigured() ? settings.default_method : 'password';

    if (method === 'email_code') {
        if (identifierType !== 'email') return { ok: false, error: 'Email codes need an email address. Use a password for usernames.' };
        if (!emailConfigured()) return { ok: false, error: NO_EMAIL_FOR_CODES };
    }

    const endsAt = parseEndsAt(input.endsAt, settings.default_ends_in_days);
    if ('error' in endsAt) return { ok: false, error: endsAt.error };
    const limit = parseDownloadLimit(input.downloadLimit, settings.default_download_limit);
    if ('error' in limit) return { ok: false, error: limit.error };

    let password: string | null = null;
    if (method === 'password') {
        const parsed = parsePassword(input.password);
        if ('error' in parsed) return { ok: false, error: parsed.error };
        password = parsed.value;
    }

    return {
        ok: true,
        value: {
            password,
            row: {
                kind: 'person',
                identifier,
                identifier_type: identifierType,
                method,
                password_hash: password ? await hashPassword(password) : null,
                ends_at: endsAt.value,
                download_limit: limit.value,
            },
        },
    };
}

/** "Anyone with the password": no identity, always a password. */
export async function parseAnyoneRecipient(input: RecipientInput, settings: OwnerSettings): Promise<Parsed<ParsedRecipient>> {
    const parsed = parsePassword(input.password);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    const endsAt = parseEndsAt(input.endsAt, settings.default_ends_in_days);
    if ('error' in endsAt) return { ok: false, error: endsAt.error };
    const limit = parseDownloadLimit(input.downloadLimit, settings.default_download_limit);
    if ('error' in limit) return { ok: false, error: limit.error };
    return {
        ok: true,
        value: {
            password: parsed.value,
            row: {
                kind: 'anyone',
                identifier: null,
                identifier_type: null,
                method: 'password',
                password_hash: await hashPassword(parsed.value),
                ends_at: endsAt.value,
                download_limit: limit.value,
            },
        },
    };
}

/** Text the owner can paste into their own email or chat. Never contains the password. */
export function inviteText(input: {
    senderName: string;
    title: string;
    kind: Delivery['kind'];
    link: string;
    recipient: Pick<Recipient, 'kind' | 'identifier' | 'identifier_type' | 'method' | 'ends_at'>;
}): string {
    const lines = [
        input.kind === 'request'
            ? `${input.senderName} asked you to upload files: "${input.title}".`
            : `${input.senderName} sent you "${input.title}".`,
        '',
        `Open it here: ${input.link}`,
    ];
    if (input.recipient.method === 'email_code') {
        lines.push(`You'll get a 6-digit code at ${input.recipient.identifier} to confirm it's you.`);
    } else if (input.recipient.kind === 'anyone') {
        lines.push("You'll need the password, which I'll send you separately.");
    } else {
        lines.push(
            `Sign in with ${input.recipient.identifier_type === 'email' ? 'your email' : 'the username'} ${input.recipient.identifier} and the password I'll send you separately.`,
        );
    }
    if (input.recipient.ends_at) {
        lines.push(`Access ends ${new Date(input.recipient.ends_at).toUTCString().replace(' GMT', ' UTC')}.`);
    }
    return lines.join('\n');
}
