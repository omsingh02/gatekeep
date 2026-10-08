import { Resend } from 'resend';
import { logError, logWarning } from '@/lib/utils/logger';

export interface OutgoingEmail {
    to: string;
    subject: string;
    html: string;
    text: string;
    /** Shown as "{fromName} via Gatekeep"; defaults to the EMAIL_FROM display name */
    fromName?: string;
    /** Replies go to the owner, not to a no-reply address */
    replyTo?: string;
}

export interface SentEmail extends OutgoingEmail {
    from: string;
    sentAt: string;
}

/**
 * EMAIL_TRANSPORT=memory keeps emails in this process instead of sending them. It exists for
 * end-to-end tests (see app/api/test-support/emails) and is never set in production.
 */
const memoryOutbox: SentEmail[] = ((globalThis as { __gatekeepOutbox?: SentEmail[] }).__gatekeepOutbox ??= []);

function isMemoryTransport(): boolean {
    return process.env.EMAIL_TRANSPORT === 'memory';
}

/** True when this instance can send email (Resend key + verified sender, or the test transport). */
export function emailConfigured(): boolean {
    if (isMemoryTransport()) return true;
    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** The bare address from EMAIL_FROM, which may be `Name <address>` or just an address. */
export function senderAddress(): string | null {
    const raw = process.env.EMAIL_FROM || (isMemoryTransport() ? 'noreply@gatekeep.test' : '');
    if (!raw) return null;
    const match = raw.match(/<([^>]+)>/);
    return (match ? match[1] : raw).trim() || null;
}

/** Display names can't carry quotes, angle brackets or line breaks into a header. */
function cleanDisplayName(name: string): string {
    return name.replace(/["<>\r\n]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70);
}

function fromHeader(fromName?: string): string | null {
    const address = senderAddress();
    if (!address) return null;
    if (fromName) return `"${cleanDisplayName(fromName)} via Gatekeep" <${address}>`;
    const configured = process.env.EMAIL_FROM?.match(/^\s*"?([^"<]+?)"?\s*</);
    return configured ? `"${cleanDisplayName(configured[1])}" <${address}>` : `"Gatekeep" <${address}>`;
}

let resendClient: Resend | null = null;

/**
 * Send one email. Never throws: email is a side channel and must not break the action that
 * triggered it. Returns whether it was handed to the provider.
 */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
    const from = fromHeader(email.fromName);
    if (!emailConfigured() || !from) {
        logWarning('email', 'not-configured', 'Email is not configured; skipped sending', { subject: email.subject });
        return false;
    }

    if (isMemoryTransport()) {
        memoryOutbox.push({ ...email, from, sentAt: new Date().toISOString() });
        if (memoryOutbox.length > 500) memoryOutbox.splice(0, memoryOutbox.length - 500);
        return true;
    }

    try {
        resendClient ??= new Resend(process.env.RESEND_API_KEY);
        const { error } = await resendClient.emails.send({
            from,
            to: email.to,
            subject: email.subject,
            html: email.html,
            text: email.text,
            ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        });
        if (error) {
            logError('email', undefined, 'send', error, { subject: email.subject });
            return false;
        }
        return true;
    } catch (err) {
        logError('email', undefined, 'send', err, { subject: email.subject });
        return false;
    }
}

/** Emails captured by the memory transport (tests only). */
export function capturedEmails(): readonly SentEmail[] {
    return isMemoryTransport() ? memoryOutbox : [];
}
