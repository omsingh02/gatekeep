import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordActivity } from '@/lib/deliveries/activity';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { publicSender, resolveDelivery, verifiedView } from '@/lib/deliveries/recipient-api';
import { readSessionToken, recipientFromSession } from '@/lib/deliveries/session';
import { getSender } from '@/lib/deliveries/settings';
import { serverError } from '@/lib/deliveries/http';

/** A returning visit counts as a new open after this long. */
const REOPEN_AFTER_MS = 30 * 60 * 1000;

/**
 * GET /api/d/{code}
 * Signed in: the delivery (title, message, files, the recipient's limits).
 * Not signed in: only who sent it and which ways in exist, never the title or files.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const { delivery } = resolved;
        const sender = await getSender(delivery.owner_id);

        const session = await recipientFromSession(delivery.id, readSessionToken(request, delivery.short_code));
        if (session.status === 'ok') {
            let recipient = session.recipient;
            const lastOpened = recipient.last_opened_at ? new Date(recipient.last_opened_at).getTime() : 0;
            if (Date.now() - lastOpened > REOPEN_AFTER_MS) {
                await createAdminClient().rpc('gk_count_open', { p_recipient_id: recipient.id });
                await recordActivity({
                    ownerId: delivery.owner_id,
                    type: 'opened',
                    deliveryId: delivery.id,
                    recipientId: recipient.id,
                    actor: recipient.identifier,
                    request,
                });
                recipient = { ...recipient, open_count: recipient.open_count + 1, last_opened_at: new Date().toISOString() };
            }
            return NextResponse.json(await verifiedView(delivery, recipient, sender));
        }

        const { data: recipients } = await createAdminClient()
            .from('delivery_recipients')
            .select('kind, method')
            .eq('delivery_id', delivery.id)
            .is('removed_at', null);
        const rows = recipients ?? [];

        const notice =
            session.status === 'removed'
                ? RECIPIENT_MESSAGES.removed(sender.name)
                : session.status === 'ended'
                  ? RECIPIENT_MESSAGES.ended(sender.name)
                  : session.status === 'expired'
                    ? RECIPIENT_MESSAGES.sessionEnded
                    : null;

        return NextResponse.json({
            verified: false,
            kind: delivery.kind,
            sender: publicSender(sender),
            access: {
                emailCode: rows.some((r) => r.kind === 'person' && r.method === 'email_code'),
                password: rows.some((r) => r.kind === 'person' && r.method === 'password'),
                anyone: rows.some((r) => r.kind === 'anyone'),
            },
            notice,
        });
    } catch (err) {
        return serverError('/api/d/[code]', undefined, 'GET', err);
    }
}
