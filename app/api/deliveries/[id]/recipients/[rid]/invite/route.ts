import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailConfigured } from '@/lib/email/transport';
import { isUuid, jsonError, requireOwner, serverError } from '@/lib/deliveries/http';
import { loadOwnedDelivery, sendInvite } from '@/lib/deliveries/owner';
import { getSender } from '@/lib/deliveries/settings';

const ROUTE = '/api/deliveries/[id]/recipients/[rid]/invite';
type Params = { params: Promise<{ id: string; rid: string }> };

const MAX_INVITES_PER_HOUR = 5;

/** POST: email the invite again (email recipients only). */
export async function POST(request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    try {
        const { id, rid } = await params;
        const delivery = isUuid(id) ? await loadOwnedDelivery(user.id, id) : null;
        if (!delivery || !isUuid(rid)) return jsonError("That person isn't on this delivery.", 404, 'ERR_NOT_FOUND');

        const admin = createAdminClient();
        const { data: recipient } = await admin
            .from('delivery_recipients')
            .select('*')
            .eq('id', rid)
            .eq('delivery_id', delivery.id)
            .maybeSingle();
        if (!recipient) return jsonError("That person isn't on this delivery.", 404, 'ERR_NOT_FOUND');
        if (recipient.removed_at) return jsonError('This person no longer has access. Add them again first.', 400, 'ERR_INVALID_INPUT');
        if (recipient.identifier_type !== 'email') {
            return jsonError('Invites can only be emailed to email addresses. Copy the invite and send it yourself.', 400, 'ERR_INVALID_INPUT');
        }
        if (!emailConfigured()) {
            return jsonError("This Gatekeep can't send email yet. Copy the invite and send it yourself.", 400, 'ERR_EMAIL_NOT_CONFIGURED');
        }

        const { count } = await admin
            .from('activity')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_id', recipient.id)
            .eq('type', 'invite_sent')
            .gte('created_at', new Date(Date.now() - 3600 * 1000).toISOString());
        if ((count ?? 0) >= MAX_INVITES_PER_HOUR) {
            return jsonError(`You've sent ${recipient.identifier} several invites in the last hour. Try again later.`, 429, 'ERR_RATE_LIMIT');
        }

        const sent = await sendInvite(delivery, recipient, await getSender(user.id), request);
        if (!sent) return jsonError("We couldn't send the invite. Try again in a moment.", 502, 'ERR_EMAIL_FAILED');
        return NextResponse.json({ ok: true });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}
