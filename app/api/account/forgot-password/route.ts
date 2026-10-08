import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { isOwner } from '@/lib/auth/owner';
import { sendEmail } from '@/lib/email/transport';
import { passwordResetEmail } from '@/lib/email/messages';
import { rateLimit } from '@/lib/utils/ratelimit';
import { logWarning } from '@/lib/utils/logger';
import { clientInfo, runAfterResponse } from '@/lib/deliveries/activity';
import { jsonError, readJson, serverError } from '@/lib/deliveries/http';

const ROUTE = '/api/account/forgot-password';
const MESSAGE = 'If that email belongs to the owner of this Gatekeep, we sent it a link to reset the password. It works for 1 hour.';

/**
 * POST { email }
 * Always answers the same way. The reset link (Supabase recovery link → /reset-password) is
 * only sent when the email belongs to the owner, and the work happens after the response.
 */
export async function POST(request: NextRequest) {
    try {
        if (!rateLimit(`forgot:${clientInfo(request).ip}`, 5, 15 * 60 * 1000).success) {
            return jsonError('Too many tries. Wait a few minutes, then try again.', 429, 'ERR_RATE_LIMIT');
        }
        const body = await readJson(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return jsonError('Enter the email address you sign in with.', 400, 'ERR_INVALID_INPUT');
        }

        runAfterResponse(async () => {
            const { data, error } = await createAdminClient().auth.admin.generateLink({
                type: 'recovery',
                email,
                options: { redirectTo: `${env.app.url}/reset-password` },
            });
            if (error || !data?.user || !data.properties?.action_link) return;
            if (!isOwner(data.user)) {
                logWarning(ROUTE, 'not-owner', 'Password reset requested for an account that is not the owner');
                return;
            }
            const message = passwordResetEmail({ email, instanceUrl: env.app.url, resetUrl: data.properties.action_link });
            await sendEmail({ to: email, ...message });
        });

        return NextResponse.json({ ok: true, message: MESSAGE });
    } catch (err) {
        return serverError(ROUTE, undefined, 'POST', err);
    }
}
