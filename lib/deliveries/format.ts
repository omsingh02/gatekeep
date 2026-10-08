import type { Tables } from '@/lib/types';
import { env } from '@/lib/env';

type Settings = Pick<Tables<'owner_settings'>, 'display_name' | 'organization'>;

/** Who the recipient sees as the sender: the owner's name, else the organization, else their email. */
export function senderName(settings: Settings | null, ownerEmail: string | null | undefined): string {
    return settings?.display_name?.trim() || settings?.organization?.trim() || ownerEmail || 'The sender';
}

/** "Avery Stone from Northwind Studio", or just the best single name. */
export function senderLabel(settings: Settings | null, ownerEmail: string | null | undefined): string {
    const name = settings?.display_name?.trim();
    const org = settings?.organization?.trim();
    if (name && org) return `${name} from ${org}`;
    return senderName(settings, ownerEmail);
}

/** Dates in emails use the instance's time zone (GATEKEEP_TIMEZONE, default UTC) and say which it is. */
export function formatDateTime(iso: string | Date): string {
    const timeZone = process.env.GATEKEEP_TIMEZONE || 'UTC';
    try {
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone,
            timeZoneName: 'short',
        }).format(new Date(iso));
    } catch {
        return new Date(iso).toUTCString();
    }
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`;
}

export function deliveryUrl(shortCode: string): string {
    return `${env.app.url}/${shortCode}`;
}

export function adminUrl(path = ''): string {
    return `${env.app.url}/admin${path}`;
}

/** Mask an email for display to someone who may not own it: m•••@acme.co */
export function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.slice(0, 1)}•••@${domain}`;
}
