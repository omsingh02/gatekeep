import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/utils/ratelimit';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/deliveries/http';

const ROUTE = '/api/account/password';
const OWNER_PASSWORD_MIN = 10;

/** POST { currentPassword, newPassword }: change the owner's password after confirming the current one. */
export async function POST(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    try {
        if (!rateLimit(`account-password:${user.id}`, 5, 15 * 60 * 1000).success) {
            return jsonError('Too many tries. Wait a few minutes, then try again.', 429, 'ERR_RATE_LIMIT');
        }
        const body = await readJson(request);
        const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
        const next = typeof body.newPassword === 'string' ? body.newPassword : '';
        if (!current) return jsonError('Enter your current password.', 400, 'ERR_INVALID_INPUT');
        if (next.length < OWNER_PASSWORD_MIN) {
            return jsonError(`Use a new password of at least ${OWNER_PASSWORD_MIN} characters.`, 400, 'ERR_INVALID_INPUT');
        }
        if (next === current) return jsonError('Choose a password you haven\'t used here before.', 400, 'ERR_INVALID_INPUT');
        if (!user.email) return jsonError("This account doesn't have an email address.", 400, 'ERR_INVALID_INPUT');

        // Confirm the current password with a throwaway client, so the signed-in session isn't touched
        const verifier = createSupabaseClient(env.supabase.url, env.supabase.anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: signInError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
        if (signInError) return jsonError("Your current password isn't right.", 400, 'ERR_WRONG_PASSWORD');
        await verifier.auth.signOut().catch(() => undefined);

        const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password: next });
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}
