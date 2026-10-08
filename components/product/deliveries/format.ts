/** Display helpers for the owner's delivery screens. Wording follows docs/VOICE.md. */
import type { BadgeTone } from '@/components/ds';
import type { AccessMethod, ActivityItem, Recipient } from './api';

const DAY = 24 * 60 * 60 * 1000;
export const ANYONE_LABEL = 'Anyone with the password';

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

export { formatFileSize as formatSize } from '@/lib/utils/fileTypes';

/** "Oct 6", or "Oct 6, 2025" outside this year. */
export function shortDate(iso: string | Date): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
}

/** "Oct 6, 2026, 3:04 PM" */
export function dateTime(iso: string | Date): string {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/** "Just now", "5 min ago", "3h ago", "Yesterday", "4 days ago", then the date. */
export function timeAgo(iso: string | Date, now = Date.now()): string {
    const ms = now - new Date(iso).getTime();
    if (ms < 60_000) return 'Just now';
    const min = Math.floor(ms / 60_000);
    if (min < 60) return `${min} min ago`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return shortDate(iso);
}

/** timeAgo for mid-sentence use: "opened yesterday", "opened Oct 6" (months keep their capital). */
export function timeAgoInSentence(iso: string | Date, now = Date.now()): string {
    const text = timeAgo(iso, now);
    return /^(Just now|Yesterday)$/.test(text) ? text.toLowerCase() : text;
}

/** "in 6 days", "in 3 hours", "tomorrow" */
export function timeUntil(iso: string | Date, now = Date.now()): string {
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return 'now';
    const days = Math.round(ms / DAY);
    if (days >= 2) return `in ${days} days`;
    const hours = Math.round(ms / 3_600_000);
    if (hours >= 2) return `in ${hours} hours`;
    return 'in less than 2 hours';
}

/** Under a recipient's name: "Ends Oct 14", or "Ended Oct 6" once it's passed. */
export function endsShort(iso: string, now = Date.now()): string {
    return `${new Date(iso).getTime() <= now ? 'Ended' : 'Ends'} ${shortDate(iso)}`;
}

/** "Ends Oct 14 · in 6 days" or "No end date" */
export function endsLabel(iso: string | null): string {
    return iso ? `Ends ${shortDate(iso)} · ${timeUntil(iso)}` : 'No end date';
}

export const METHOD_LABELS: Record<AccessMethod, string> = {
    email_code: 'Email code',
    password: 'Password',
};

/** The status pill for one recipient: Active, Ends in N days, Download limit reached, Ended, Removed. */
export function recipientPill(recipient: Pick<Recipient, 'status' | 'endsAt'>, now = Date.now()): { tone: BadgeTone; label: string } {
    switch (recipient.status) {
        case 'removed':
            return { tone: 'neutral', label: 'Removed' };
        case 'ended':
            return { tone: 'danger', label: 'Ended' };
        case 'limit_reached':
            return { tone: 'warning', label: 'Download limit reached' };
        default: {
            if (recipient.endsAt) {
                const ms = new Date(recipient.endsAt).getTime() - now;
                if (ms < DAY) return { tone: 'warning', label: 'Ends today' };
                // Amber means "ending soon", not "has an end date": only the last 3 days
                if (ms < 3 * DAY) {
                    const days = Math.ceil(ms / DAY);
                    return { tone: 'warning', label: days === 1 ? 'Ends tomorrow' : `Ends in ${days} days` };
                }
            }
            return { tone: 'success', label: 'Active' };
        }
    }
}

/** "1 of 3" with a limit, "2" without. */
export function downloadsLabel(recipient: Pick<Recipient, 'downloadCount' | 'downloadLimit'>): string {
    return recipient.downloadLimit !== null ? `${recipient.downloadCount} of ${recipient.downloadLimit}` : String(recipient.downloadCount);
}

/**
 * A short name for sentences: "maya@northwind.example" → "Maya"; other emails and usernames stay
 * as they are; "Anyone with the password" becomes lower case mid-sentence.
 */
export function shortName(label: string): string {
    if (label === ANYONE_LABEL) return 'anyone with the password';
    const at = label.indexOf('@');
    if (at > 0) {
        const local = label.slice(0, at);
        if (/^[a-z]+$/i.test(local)) return local[0].toUpperCase() + local.slice(1);
    }
    return label;
}

/** "Maya's", "j.chen's" (and "anyone with the password" stays as is) */
export function possessive(label: string): string {
    const name = shortName(label);
    if (label === ANYONE_LABEL) return name;
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

/** Title for a new delivery from its first file: "Q3 board deck.pdf" → "Q3 board deck". */
export function titleFromFileName(name: string): string {
    const dot = name.lastIndexOf('.');
    return (dot > 0 ? name.slice(0, dot) : name).replace(/[-_]+/g, ' ').trim();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[^\s@,;]{2,64}$/;

/** Split pasted text into people: commas, semicolons, spaces and new lines all separate. */
export function parsePeople(text: string): { valid: { identifier: string; identifierType: 'email' | 'username' }[]; invalid: string[] } {
    const valid: { identifier: string; identifierType: 'email' | 'username' }[] = [];
    const invalid: string[] = [];
    for (const raw of text.split(/[\s,;]+/)) {
        // "Maya Chen <maya@acme.co>" pastes arrive as "<maya@acme.co>"
        const token = raw.replace(/^<|>$/g, '').trim();
        if (!token) continue;
        if (token.includes('@')) {
            if (EMAIL.test(token)) valid.push({ identifier: token.toLowerCase(), identifierType: 'email' });
            else invalid.push(token);
        } else if (USERNAME.test(token)) {
            valid.push({ identifier: token.toLowerCase(), identifierType: 'username' });
        } else {
            invalid.push(token);
        }
    }
    return { valid, invalid };
}

/** One human sentence per activity event (docs/VOICE.md: people and files, not records). */
export function activitySentence(item: ActivityItem): string {
    const anyone = item.actor === ANYONE_LABEL;
    const who = anyone ? 'Someone with the password' : item.actor;
    const file = item.fileName ?? 'a file';
    switch (item.type) {
        case 'opened':
            return `${who} opened the delivery`;
        case 'previewed':
            return `${who} previewed ${file}`;
        case 'downloaded':
            return `${who} downloaded ${file}`;
        case 'downloaded_all':
            return `${who} downloaded all files`;
        case 'denied': {
            const reason = item.reasonLabel ? ` — ${item.reasonLabel.toLowerCase()}` : '';
            const subject = anyone || !item.actor || item.actor === 'You' ? 'Someone' : item.actor;
            return `${subject} was denied${reason}`;
        }
        case 'code_sent':
            return `Code sent to ${item.actor}`;
        case 'uploaded':
            return `${who} uploaded ${file}`;
        case 'access_given':
            return anyone ? 'You gave access to anyone with the password' : `You gave ${item.actor} access`;
        case 'access_removed':
            return anyone ? 'You removed access for anyone with the password' : `You removed ${possessive(item.actor)} access`;
        case 'invite_sent':
            return `Invite sent to ${item.actor}`;
        default:
            return item.typeLabel;
    }
}
