import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import type { Database, Tables } from '@/lib/types';
import type { Sender } from '@/lib/email/messages';
import { senderLabel, senderName } from './format';

export type OwnerSettings = Tables<'owner_settings'>;
type SettingsUpdate = Database['public']['Tables']['owner_settings']['Update'];

export function defaultSettings(ownerId: string): OwnerSettings {
    return {
        owner_id: ownerId,
        display_name: null,
        organization: null,
        logo_path: null,
        recipient_message: null,
        default_method: 'email_code',
        default_ends_in_days: null,
        default_download_limit: null,
        notify_opened: true,
        notify_downloaded: false,
        notify_denied: true,
        notify_uploaded: true,
        homepage: 'branded',
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
    };
}

/** The owner's settings, or the defaults when they haven't saved any yet. */
export async function getOwnerSettings(ownerId: string): Promise<OwnerSettings> {
    const { data } = await createAdminClient().from('owner_settings').select('*').eq('owner_id', ownerId).maybeSingle();
    return data ?? defaultSettings(ownerId);
}

export function logoUrl(settings: Pick<OwnerSettings, 'logo_path'>): string | null {
    return settings.logo_path ? `${env.supabase.url}/storage/v1/object/public/branding/${settings.logo_path}` : null;
}

export async function getOwnerEmail(ownerId: string): Promise<string | null> {
    const { data } = await createAdminClient().auth.admin.getUserById(ownerId);
    return data?.user?.email ?? null;
}

export interface SenderIdentity extends Sender {
    email: string | null;
    message: string | null;
}

/** Who recipients see as the sender of a delivery. */
export async function getSender(ownerId: string, settings?: OwnerSettings): Promise<SenderIdentity> {
    const [resolved, email] = await Promise.all([settings ?? getOwnerSettings(ownerId), getOwnerEmail(ownerId)]);
    return {
        name: senderName(resolved, email),
        label: senderLabel(resolved, email),
        logoUrl: logoUrl(resolved),
        email,
        message: resolved.recipient_message,
    };
}

function optionalText(value: unknown, max: number, field: string): { value: string | null } | { error: string } {
    if (value === null || value === undefined) return { value: null };
    if (typeof value !== 'string') return { error: `${field} must be text.` };
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (trimmed.length > max) return { error: `${field} can be at most ${max} characters.` };
    return { value: trimmed || null };
}

function optionalCount(value: unknown, max: number, message: string): { value: number | null } | { error: string } {
    if (value === null || value === undefined || value === '') return { value: null };
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > max) return { error: message };
    return { value: n };
}

/** Validate a settings PATCH body. Unknown keys are ignored. */
export function parseSettingsPatch(body: Record<string, unknown>): { update: SettingsUpdate } | { error: string } {
    const update: SettingsUpdate = {};

    const texts: [keyof SettingsUpdate, string, number, string][] = [
        ['display_name', 'displayName', 80, 'Your name'],
        ['organization', 'organization', 80, 'Organization'],
    ];
    for (const [column, key, max, label] of texts) {
        if (key in body) {
            const parsed = optionalText(body[key], max, label);
            if ('error' in parsed) return parsed;
            (update as Record<string, unknown>)[column] = parsed.value;
        }
    }

    if ('recipientMessage' in body) {
        const raw = body.recipientMessage;
        if (raw !== null && raw !== undefined && typeof raw !== 'string') return { error: 'The message must be text.' };
        const message = typeof raw === 'string' ? raw.trim() : '';
        if (message.length > 500) return { error: 'The message can be at most 500 characters.' };
        update.recipient_message = message || null;
    }

    if ('defaultMethod' in body) {
        if (body.defaultMethod !== 'email_code' && body.defaultMethod !== 'password') {
            return { error: 'Choose email code or password as the default.' };
        }
        update.default_method = body.defaultMethod;
    }

    if ('defaultEndsInDays' in body) {
        const parsed = optionalCount(body.defaultEndsInDays, 3650, 'The default end must be between 1 and 3650 days.');
        if ('error' in parsed) return parsed;
        update.default_ends_in_days = parsed.value;
    }

    if ('defaultDownloadLimit' in body) {
        const parsed = optionalCount(body.defaultDownloadLimit, 1000, 'The default download limit must be between 1 and 1000.');
        if ('error' in parsed) return parsed;
        update.default_download_limit = parsed.value;
    }

    const toggles: [keyof SettingsUpdate, string][] = [
        ['notify_opened', 'notifyOpened'],
        ['notify_downloaded', 'notifyDownloaded'],
        ['notify_denied', 'notifyDenied'],
        ['notify_uploaded', 'notifyUploaded'],
    ];
    for (const [column, key] of toggles) {
        if (key in body) {
            if (typeof body[key] !== 'boolean') return { error: 'Notification settings must be on or off.' };
            (update as Record<string, unknown>)[column] = body[key];
        }
    }

    if ('homepage' in body) {
        if (body.homepage !== 'landing' && body.homepage !== 'branded') return { error: 'Choose a homepage style.' };
        update.homepage = body.homepage;
    }

    return { update };
}

/** API shape: camelCase, plus derived values. */
export function serializeSettings(settings: OwnerSettings, extras: { ownerEmail: string | null; emailConfigured: boolean }) {
    return {
        displayName: settings.display_name,
        organization: settings.organization,
        logoUrl: logoUrl(settings),
        recipientMessage: settings.recipient_message,
        defaultMethod: settings.default_method,
        defaultEndsInDays: settings.default_ends_in_days,
        defaultDownloadLimit: settings.default_download_limit,
        notifyOpened: settings.notify_opened,
        notifyDownloaded: settings.notify_downloaded,
        notifyDenied: settings.notify_denied,
        notifyUploaded: settings.notify_uploaded,
        homepage: settings.homepage,
        ownerEmail: extras.ownerEmail,
        emailConfigured: extras.emailConfigured,
        senderPreview: senderLabel(settings, extras.ownerEmail),
    };
}
