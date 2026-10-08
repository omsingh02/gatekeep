import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RECIPIENT_MESSAGES } from './labels';
import { loadDeliveryByCode, recipientLabel, type Delivery, type Recipient } from './deliveries';
import { readSessionToken, recipientFromSession } from './session';
import { getSender, type SenderIdentity } from './settings';
import { deliveryFiles } from './owner';

export type ResolvedDelivery = { delivery: Delivery } | { response: NextResponse };

export async function resolveDelivery(code: string): Promise<ResolvedDelivery> {
    const delivery = await loadDeliveryByCode(code);
    if (!delivery) {
        return { response: NextResponse.json({ error: RECIPIENT_MESSAGES.notFound, code: 'ERR_NOT_FOUND' }, { status: 404 }) };
    }
    return { delivery };
}

export type ResolvedRecipient =
    | { recipient: Recipient; sender: SenderIdentity }
    | { response: NextResponse };

/** The signed-in recipient for this delivery, or the 401/403 response explaining why not. */
export async function requireRecipient(request: NextRequest, delivery: Delivery): Promise<ResolvedRecipient> {
    const session = await recipientFromSession(delivery.id, readSessionToken(request, delivery.short_code));
    if (session.status === 'ok') return { recipient: session.recipient, sender: await getSender(delivery.owner_id) };

    const sender = await getSender(delivery.owner_id);
    const byStatus = {
        none: { status: 401, error: RECIPIENT_MESSAGES.sessionEnded, code: 'ERR_SIGNED_OUT' },
        expired: { status: 401, error: RECIPIENT_MESSAGES.sessionEnded, code: 'ERR_SESSION_ENDED' },
        removed: { status: 403, error: RECIPIENT_MESSAGES.removed(sender.name), code: 'ERR_REMOVED' },
        ended: { status: 403, error: RECIPIENT_MESSAGES.ended(sender.name), code: 'ERR_ENDED' },
    } as const;
    const { status, error, code } = byStatus[session.status];
    return { response: NextResponse.json({ error, code }, { status }) };
}

export function publicSender(sender: SenderIdentity) {
    return { name: sender.name, label: sender.label, logoUrl: sender.logoUrl ?? null, message: sender.message };
}

/** Everything a signed-in recipient sees. */
export async function verifiedView(delivery: Delivery, recipient: Recipient, sender: SenderIdentity) {
    const files = delivery.kind === 'send' ? await deliveryFiles(delivery.id) : [];
    let uploads: { count: number; files: { id: string; name: string; size: number }[] } | null = null;
    if (delivery.kind === 'request') {
        const { data } = await createAdminClient()
            .from('files')
            .select('id, original_filename, file_size')
            .eq('received_via_delivery_id', delivery.id)
            .eq('received_from_recipient_id', recipient.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
        uploads = {
            count: data?.length ?? 0,
            files: (data ?? []).map((f) => ({ id: f.id, name: f.original_filename, size: f.file_size })),
        };
    }
    return {
        verified: true as const,
        delivery: {
            kind: delivery.kind,
            title: delivery.title,
            message: delivery.message,
            files,
            request:
                delivery.kind === 'request'
                    ? {
                          maxFiles: delivery.request_max_files,
                          maxFileMb: delivery.request_max_file_mb ?? 100,
                          uploaded: uploads,
                      }
                    : null,
        },
        sender: publicSender(sender),
        recipient: {
            kind: recipient.kind,
            label: recipientLabel(recipient),
            endsAt: recipient.ends_at,
            downloadLimit: recipient.download_limit,
            downloadCount: recipient.download_count,
            downloadsLeft:
                recipient.download_limit === null ? null : Math.max(recipient.download_limit - recipient.download_count, 0),
        },
    };
}
