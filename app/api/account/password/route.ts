import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/utils/ratelimit';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/deliveries/http';
import { OWNER_PASSWORD_MIN } from '@/lib/utils/passwordStrength';

const ROUTE = '/api/account/password';

/**
 * POST { currentPassword, newPassword } → { ok, signedIn }
 * Change the owner's password after confirming the current one. Other sessions end; this one is renewed.
 */
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
        // Only end the throwaway session: the default (global) scope would also sign the owner out here
        await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);

        // Supabase ends every session of the account when its password changes, which is what we
        // want for other browsers and devices. Sign this browser straight back in with the new
        // password (the server client writes the session cookies), so the owner stays signed in here.
        const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password: next });
        if (error) throw error;
        const supabase = await createServerSupabase();
        const { error: renewError } = await supabase.auth.signInWithPassword({ email: user.email, password: next });
        return NextResponse.json({ ok: true, signedIn: !renewError });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}
