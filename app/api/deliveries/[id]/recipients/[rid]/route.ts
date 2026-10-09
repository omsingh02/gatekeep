import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailConfigured, sendEmail } from '@/lib/email/transport';
import { accessRemovedEmail } from '@/lib/email/messages';
import { hashPassword } from '@/lib/utils/crypto';
import { recordActivity } from '@/lib/deliveries/activity';
import { generateReadablePassword } from '@/lib/deliveries/codes';
import { NO_EMAIL_FOR_CODES, parseDownloadLimit, parseEndsAt } from '@/lib/deliveries/deliveries';
import { isUuid, jsonError, readJson, requireOwner, serverError } from '@/lib/api/http';
import { loadOwnedDelivery, recipientResult } from '@/lib/deliveries/owner';
import { getSender } from '@/lib/deliveries/settings';
import type { Database } from '@/lib/types';

const ROUTE = '/api/deliveries/[id]/recipients/[rid]';
type Params = { params: Promise<{ id: string; rid: string }> };

async function load(ownerId: string, id: string, rid: string) {
    if (!isUuid(id) || !isUuid(rid)) return null;
    const delivery = await loadOwnedDelivery(ownerId, id);
    if (!delivery) return null;
    const { data: recipient } = await createAdminClient()
        .from('delivery_recipients')
        .select('*')
        .eq('id', rid)
        .eq('delivery_id', delivery.id)
        .maybeSingle();
    return recipient ? { delivery, recipient } : null;
}

const NOT_FOUND = () => jsonError("That person isn't on this delivery.", 404, 'ERR_NOT_FOUND');

/**
 * PATCH { endsAt?, downloadLimit?, resetDownloads?, method?, password?, regeneratePassword? }
 * Changing the end date or download limit keeps the recipient signed in; changing how they
 * sign in (method or password) ends their session.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'PATCH');
    if (user instanceof NextResponse) return user;
    try {
        const { id, rid } = await params;
        const found = await load(user.id, id, rid);
        if (!found) return NOT_FOUND();
        const { delivery, recipient } = found;
        if (recipient.removed_at) return jsonError('This person no longer has access. Add them again instead.', 400, 'ERR_INVALID_INPUT');

        const body = await readJson(request);
        const update: Database['public']['Tables']['delivery_recipients']['Update'] = {};
        let newPassword: string | null = null;
        let endSession = false;

        if ('endsAt' in body) {
            const parsed = parseEndsAt(body.endsAt, null);
            if ('error' in parsed) return jsonError(parsed.error, 400, 'ERR_INVALID_INPUT');
            update.ends_at = parsed.value;
            update.ending_notice_sent_at = null;
        }
        if ('downloadLimit' in body) {
            const parsed = parseDownloadLimit(body.downloadLimit, null);
            if ('error' in parsed) return jsonError(parsed.error, 400, 'ERR_INVALID_INPUT');
            update.download_limit = parsed.value;
        }
        if (body.resetDownloads === true) update.download_count = 0;

        const method = body.method === 'email_code' || body.method === 'password' ? body.method : recipient.method;
        if (method !== recipient.method) {
            if (method === 'email_code') {
                if (recipient.identifier_type !== 'email') {
                    return jsonError('Email codes need an email address. Use a password for usernames.', 400, 'ERR_INVALID_INPUT');
                }
                if (!emailConfigured()) return jsonError(NO_EMAIL_FOR_CODES, 400, 'ERR_EMAIL_NOT_CONFIGURED');
                update.method = 'email_code';
                update.password_hash = null;
            } else {
                update.method = 'password';
            }
            endSession = true;
        }

        const wantsPassword = method === 'password' && (body.regeneratePassword === true || typeof body.password === 'string' || method !== recipient.method);
        if (wantsPassword) {
            if (typeof body.password === 'string' && body.password !== '') {
                if (body.password.length < 8) return jsonError('Use a password of at least 8 characters.', 400, 'ERR_INVALID_INPUT');
                newPassword = body.password;
            } else {
                newPassword = generateReadablePassword();
            }
            update.password_hash = await hashPassword(newPassword);
            endSession = true;
        }

        if (endSession) update.session_expires_at = new Date().toISOString();
        if (Object.keys(update).length === 0) return jsonError('Nothing to change.', 400, 'ERR_INVALID_INPUT');

        const { data: updated, error } = await createAdminClient()
            .from('delivery_recipients')
            .update(update)
            .eq('id', recipient.id)
            .select('*')
            .single();
        if (error || !updated) throw error ?? new Error('Update failed');

        const sender = await getSender(user.id);
        return NextResponse.json({
            recipient: recipientResult(delivery, updated, sender, { password: newPassword, inviteSent: false }),
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'PATCH', err);
    }
}

/**
 * DELETE ?notify=1
 * Removes access immediately, including an open session. The row is kept so activity still
 * names the person. With notify=1, email recipients are told by email.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'DELETE');
    if (user instanceof NextResponse) return user;
    try {
        const { id, rid } = await params;
        const found = await load(user.id, id, rid);
        if (!found) return NOT_FOUND();
        const { delivery, recipient } = found;
        if (recipient.removed_at) return NextResponse.json({ ok: true });

        const now = new Date().toISOString();
        const { error } = await createAdminClient()
            .from('delivery_recipients')
            .update({ removed_at: now, session_expires_at: now })
            .eq('id', recipient.id);
        if (error) throw error;

        await recordActivity({
            ownerId: user.id,
            type: 'access_removed',
            deliveryId: delivery.id,
            recipientId: recipient.id,
            actor: recipient.identifier,
            request,
            notify: false,
        });

        let notified = false;
        if (request.nextUrl.searchParams.get('notify') === '1' && recipient.identifier_type === 'email' && recipient.identifier) {
            const sender = await getSender(user.id);
            const email = accessRemovedEmail({ sender, title: delivery.title });
            notified = await sendEmail({ to: recipient.identifier, ...email, fromName: sender.name, replyTo: sender.email ?? undefined });
        }
        return NextResponse.json({ ok: true, notified });
    } catch (err) {
        return serverError(ROUTE, user.id, 'DELETE', err);
    }
}
