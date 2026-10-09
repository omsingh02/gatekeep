import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/utils/ratelimit';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/deliveries/http';
import { OWNER_PASSWORD_MIN } from '@/lib/utils/passwordStrength';
import { cleanCode, codeError, codeProblem, hasTwoFactor } from '@/lib/auth/twoFactor';

const ROUTE = '/api/account/password';

/**
 * POST { currentPassword, newPassword, code? } → { ok, signedIn }
 * Change the owner's password after confirming the current one (and, with two-factor sign-in on, a code
 * from the authenticator app). Other sessions end; this one is renewed.
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

        const twoFactor = hasTwoFactor(user);
        const code = typeof body.code === 'string' ? cleanCode(body.code) : '';
        const codeMissing = twoFactor ? codeProblem(code) : null;
        if (codeMissing) return jsonError(codeMissing, 400, 'ERR_CODE_REQUIRED');

        // Confirm the current password with a throwaway client, so the signed-in session isn't touched
        const verifier = createSupabaseClient(env.supabase.url, env.supabase.anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: signInError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
        if (signInError) return jsonError("Your current password isn't right.", 400, 'ERR_WRONG_PASSWORD');

        if (twoFactor) return await changeWithCode(verifier, code, current, next);
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

/**
 * Two-factor sign-in is on. Signing straight back in with the new password would leave this browser
 * with a password-only session, so the throwaway session enters the code instead and changes the
 * password itself. Supabase then ends every other session of the account (this browser's old one too),
 * and this browser carries on with the throwaway session, which has both steps.
 */
async function changeWithCode(verifier: SupabaseClient, code: string, current: string, next: string): Promise<NextResponse> {
    const discard = () => verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);
    const { data: factors, error: listError } = await verifier.auth.mfa.listFactors();
    if (listError) throw listError;
    const factor = factors.totp[0];
    if (!factor) throw new Error('Two-factor sign-in is on but the account has no authenticator app');

    const { error: verifyError } = await verifier.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verifyError) {
        await discard();
        const { message, wrongCode } = codeError(verifyError);
        if (wrongCode) return jsonError(message, 400, 'ERR_WRONG_CODE');
        if (verifyError.status === 429) return jsonError(message, 429, 'ERR_RATE_LIMIT');
        throw verifyError;
    }

    // current_password only matters on projects that require it ("Require current password when updating")
    const { error: updateError } = await verifier.auth.updateUser({ password: next, current_password: current });
    if (updateError) {
        await discard();
        if (updateError.code === 'weak_password') return jsonError('Choose a longer password, with a few unrelated words.', 400, 'ERR_INVALID_INPUT');
        if (updateError.code === 'same_password') return jsonError("Choose a password you haven't used here before.", 400, 'ERR_INVALID_INPUT');
        throw updateError;
    }

    const {
        data: { session },
    } = await verifier.auth.getSession();
    if (!session) return NextResponse.json({ ok: true, signedIn: false });
    const supabase = await createServerSupabase();
    const { error: renewError } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    return NextResponse.json({ ok: true, signedIn: !renewError });
}
