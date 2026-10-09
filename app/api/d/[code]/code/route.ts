import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/transport';
import { codeEmail } from '@/lib/email/messages';
import { rateLimit } from '@/lib/utils/ratelimit';
import { sanitizeUserIdentifier } from '@/lib/utils/sanitization';
import { clientInfo, codeRequestsThrottled, recordActivity, runAfterResponse } from '@/lib/deliveries/activity';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { readJson, serverError } from '@/lib/api/http';
import { resolveDelivery } from '@/lib/deliveries/recipient-api';
import { getSender } from '@/lib/deliveries/settings';
import { issueCode } from '@/lib/deliveries/verification';

/**
 * POST /api/d/{code}/code  { email }
 * Always answers the same way, whether or not the email has access, and does the lookup and
 * sending after the response, so neither the message nor the timing reveals who's on a delivery.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const { delivery } = resolved;

        const body = await readJson(request);
        const email = sanitizeUserIdentifier(typeof body.email === 'string' ? body.email : '');
        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: RECIPIENT_MESSAGES.invalidEmail, code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const { ip } = clientInfo(request);
        if (!rateLimit(`code:${ip}`, 10, 10 * 60 * 1000).success || (await codeRequestsThrottled(ip))) {
            return NextResponse.json({ error: RECIPIENT_MESSAGES.throttled, code: 'ERR_RATE_LIMIT' }, { status: 429 });
        }

        runAfterResponse(async () => {
            const { data: recipient } = await createAdminClient()
                .from('delivery_recipients')
                .select('*')
                .eq('delivery_id', delivery.id)
                .eq('identifier', email)
                .eq('method', 'email_code')
                .is('removed_at', null)
                .maybeSingle();

            if (!recipient) {
                await recordActivity({
                    ownerId: delivery.owner_id,
                    type: 'denied',
                    reason: 'not_on_delivery',
                    deliveryId: delivery.id,
                    actor: email,
                    request,
                });
                return;
            }

            const issued = await issueCode(recipient.id);
            if (!issued) return; // too many codes recently; the latest one still works

            const sender = await getSender(delivery.owner_id);
            const message = codeEmail({ sender, title: delivery.title, code: issued });
            const sent = await sendEmail({ to: email, ...message, fromName: sender.name, replyTo: sender.email ?? undefined });
            if (sent) {
                await recordActivity({
                    ownerId: delivery.owner_id,
                    type: 'code_sent',
                    deliveryId: delivery.id,
                    recipientId: recipient.id,
                    actor: email,
                    request,
                    notify: false,
                });
            }
        });

        return NextResponse.json({ ok: true, message: RECIPIENT_MESSAGES.codeSent });
    } catch (err) {
        return serverError('/api/d/[code]/code', undefined, 'POST', err);
    }
}
