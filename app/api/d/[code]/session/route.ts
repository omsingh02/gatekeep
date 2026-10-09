import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/utils/ratelimit';
import { verifyAgainstDummy, verifyPassword } from '@/lib/utils/crypto';
import { sanitizeUserIdentifier } from '@/lib/utils/sanitization';
import { generateRequestId } from '@/lib/utils/logger';
import { clientInfo, guessingThrottled, recordActivity } from '@/lib/deliveries/activity';
import { accessProblem, type Recipient } from '@/lib/deliveries/deliveries';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { readJson, serverError } from '@/lib/api/http';
import { resolveDelivery, verifiedView } from '@/lib/deliveries/recipient-api';
import {
    clearSessionCookie,
    endSession,
    readSessionToken,
    recipientFromSession,
    setSessionCookie,
    startSession,
} from '@/lib/deliveries/session';
import { getSender } from '@/lib/deliveries/settings';
import { checkCode, checkCodeAgainstNothing } from '@/lib/deliveries/verification';
import type { ActivityReason } from '@/lib/types';

type Params = { params: Promise<{ code: string }> };

const deny = (error: string, status = 403, code = 'ERR_DENIED') => NextResponse.json({ error, code }, { status });

/**
 * POST /api/d/{code}/session
 *   { email, code }          email-code recipients
 *   { identifier, password } password recipients
 *   { password }             anyone with the password
 * Credentials are checked first; whether access has ended is only revealed after they match.
 * Wrong code and "not on this delivery" (and wrong password and unknown person) answer identically.
 */
export async function POST(request: NextRequest, { params }: Params) {
    const requestId = generateRequestId();
    try {
        const { code } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const { delivery } = resolved;
        const admin = createAdminClient();

        const { ip } = clientInfo(request);
        if (!rateLimit(`session:${ip}`, 10, 60 * 1000).success || (await guessingThrottled(delivery.id, ip))) {
            return deny(RECIPIENT_MESSAGES.throttled, 429, 'ERR_RATE_LIMIT');
        }

        const body = await readJson(request);
        const denied = async (reason: ActivityReason, actor: string | null, recipientId: string | null = null) =>
            recordActivity({
                ownerId: delivery.owner_id,
                type: 'denied',
                reason,
                deliveryId: delivery.id,
                recipientId,
                actor,
                request,
                requestId,
            });

        let recipient: Recipient | null = null;

        if (typeof body.code === 'string') {
            // Email code
            const email = sanitizeUserIdentifier(typeof body.email === 'string' ? body.email : '');
            const { data } = email
                ? await admin
                      .from('delivery_recipients')
                      .select('*')
                      .eq('delivery_id', delivery.id)
                      .eq('identifier', email)
                      .eq('method', 'email_code')
                      .is('removed_at', null)
                      .maybeSingle()
                : { data: null };
            if (!data) {
                checkCodeAgainstNothing(body.code);
                await denied('not_on_delivery', email || null);
                return deny(RECIPIENT_MESSAGES.code);
            }
            const result = await checkCode(data.id, body.code);
            if (result !== 'ok') {
                await denied(result === 'wrong' ? 'wrong_code' : 'code_expired', data.identifier, data.id);
                return deny(RECIPIENT_MESSAGES.code);
            }
            recipient = data;
        } else if (typeof body.password === 'string' && body.password) {
            const password = body.password;
            if (typeof body.identifier === 'string' && body.identifier.trim()) {
                // A named person with their own password
                const identifier = sanitizeUserIdentifier(body.identifier);
                const { data } = identifier
                    ? await admin
                          .from('delivery_recipients')
                          .select('*')
                          .eq('delivery_id', delivery.id)
                          .eq('identifier', identifier)
                          .eq('method', 'password')
                          .is('removed_at', null)
                          .maybeSingle()
                    : { data: null };
                const ok = data?.password_hash ? await verifyPassword(password, data.password_hash) : await verifyAgainstDummy(password);
                if (!data || !ok) {
                    await denied(data ? 'wrong_password' : 'not_on_delivery', identifier || null, data?.id ?? null);
                    return deny(RECIPIENT_MESSAGES.credentials);
                }
                recipient = data;
            } else {
                // Anyone with the password
                const { data } = await admin
                    .from('delivery_recipients')
                    .select('*')
                    .eq('delivery_id', delivery.id)
                    .eq('kind', 'anyone')
                    .is('removed_at', null)
                    .maybeSingle();
                const ok = data?.password_hash ? await verifyPassword(password, data.password_hash) : await verifyAgainstDummy(password);
                if (!data || !ok) {
                    await denied(data ? 'wrong_password' : 'not_on_delivery', null, data?.id ?? null);
                    return deny(RECIPIENT_MESSAGES.credentials);
                }
                recipient = data;
            }
        } else {
            return deny('Enter the code from your email, or your password.', 400, 'ERR_INVALID_INPUT');
        }

        // Credentials matched. Now the grant's own state.
        const sender = await getSender(delivery.owner_id);
        if (accessProblem(recipient) === 'ended') {
            await denied('ended', recipient.identifier, recipient.id);
            return deny(RECIPIENT_MESSAGES.ended(sender.name), 403, 'ERR_ENDED');
        }

        const { token, expiresAt } = await startSession(recipient.id);
        await admin.rpc('gk_count_open', { p_recipient_id: recipient.id });
        await recordActivity({
            ownerId: delivery.owner_id,
            type: 'opened',
            deliveryId: delivery.id,
            recipientId: recipient.id,
            actor: recipient.identifier,
            request,
            requestId,
        });

        const fresh = { ...recipient, open_count: recipient.open_count + 1, last_opened_at: new Date().toISOString() };
        const response = NextResponse.json(await verifiedView(delivery, fresh, sender));
        setSessionCookie(response, delivery.short_code, token, expiresAt);
        return response;
    } catch (err) {
        return serverError('/api/d/[code]/session', undefined, 'POST', err);
    }
}

/** DELETE /api/d/{code}/session: sign out of this delivery on this device. */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { code } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const session = await recipientFromSession(resolved.delivery.id, readSessionToken(request, resolved.delivery.short_code));
        if (session.status === 'ok') await endSession(session.recipient.id);
        const response = NextResponse.json({ ok: true });
        clearSessionCookie(response, resolved.delivery.short_code);
        return response;
    } catch (err) {
        return serverError('/api/d/[code]/session', undefined, 'DELETE', err);
    }
}
