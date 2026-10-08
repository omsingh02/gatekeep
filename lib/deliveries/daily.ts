import { createAdminClient } from '@/lib/supabase/admin';
import { emailConfigured, sendEmail } from '@/lib/email/transport';
import { accessEndingEmail } from '@/lib/email/messages';
import { logError } from '@/lib/utils/logger';
import { deliveryUrl } from './format';
import { notifyPendingUploads } from './notifications';
import { getSender, type SenderIdentity } from './settings';
import { purgeOldCodes } from './verification';

/** Recipients whose access ends within this window get one reminder. */
export const ENDING_SOON_MS = 48 * 3600 * 1000;

/** Email recipients whose access ends in the next 48 hours, once each. */
export async function sendEndingSoonNotices(): Promise<number> {
    if (!emailConfigured()) return 0;
    const admin = createAdminClient();
    const now = new Date();
    const { data: recipients } = await admin
        .from('delivery_recipients')
        .select('id, identifier, ends_at, delivery_id, deliveries!inner(id, owner_id, title, short_code, kind, deleted_at)')
        .eq('kind', 'person')
        .eq('identifier_type', 'email')
        .is('removed_at', null)
        .is('ending_notice_sent_at', null)
        .gt('ends_at', now.toISOString())
        .lte('ends_at', new Date(now.getTime() + ENDING_SOON_MS).toISOString())
        .is('deliveries.deleted_at', null)
        .limit(500);

    const senders = new Map<string, SenderIdentity>();
    let sent = 0;
    for (const recipient of recipients ?? []) {
        const delivery = recipient.deliveries;
        if (!recipient.identifier || !recipient.ends_at) continue;
        try {
            let sender = senders.get(delivery.owner_id);
            if (!sender) {
                sender = await getSender(delivery.owner_id);
                senders.set(delivery.owner_id, sender);
            }
            const email = accessEndingEmail({
                sender,
                title: delivery.title,
                url: deliveryUrl(delivery.short_code),
                endsAt: recipient.ends_at,
            });
            if (await sendEmail({ to: recipient.identifier, ...email, fromName: sender.name, replyTo: sender.email ?? undefined })) {
                await admin.from('delivery_recipients').update({ ending_notice_sent_at: now.toISOString() }).eq('id', recipient.id);
                sent++;
            }
        } catch (err) {
            logError('daily', delivery.owner_id, 'ending-soon', err);
        }
    }
    return sent;
}

export async function runDailyJobs(): Promise<{ endingSoonSent: number; codesPurged: number; uploadNotices: number }> {
    const [endingSoonSent, codesPurged, uploadNotices] = await Promise.all([
        sendEndingSoonNotices().catch((err) => {
            logError('daily', undefined, 'ending-soon', err);
            return 0;
        }),
        purgeOldCodes().catch((err) => {
            logError('daily', undefined, 'purge-codes', err);
            return 0;
        }),
        notifyPendingUploads().catch((err) => {
            logError('daily', undefined, 'pending-uploads', err);
            return 0;
        }),
    ]);
    return { endingSoonSent, codesPurged, uploadNotices };
}
