import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Two-factor sign-in (a code from an authenticator app, Supabase Auth's TOTP factor).
 *
 * Supabase marks every session with how it signed in: `aal1` after the password only, `aal2` after
 * the password and a code. An account that has turned two-factor sign-in on (it has a verified
 * factor) must reach `aal2` before it can use anything: `proxy.ts`, `validateAuth` and the database's
 * row-level security all check this. It is per account, so it holds for any number of accounts.
 */
export type AssuranceLevel = 'aal1' | 'aal2';

/** The code an owner API answers with while the session still has to enter its code. */
export const TWO_FACTOR_REQUIRED = 'ERR_TWO_FACTOR_REQUIRED';

/** Whether the account has turned two-factor sign-in on (any verified factor counts, like in the database). */
export function hasTwoFactor(user: Pick<User, 'factors'> | null | undefined): boolean {
    return Boolean(user?.factors?.some((factor) => factor.status === 'verified'));
}

/**
 * The `aal` claim of a Supabase access token, or null when it has none or can't be read.
 * Only trust it for a token the auth server has just accepted (see getSignedIn).
 */
export function assuranceLevel(accessToken: string | null | undefined): AssuranceLevel | null {
    const payload = accessToken?.split('.')[1];
    if (!payload) return null;
    try {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))) as { aal?: unknown };
        return json.aal === 'aal1' || json.aal === 'aal2' ? json.aal : null;
    } catch {
        return null;
    }
}

/** True while an account with two-factor sign-in has only entered its password in this session. */
export function needsTwoFactorCode(user: Pick<User, 'factors'> | null | undefined, aal: AssuranceLevel | null | undefined): boolean {
    return hasTwoFactor(user) && aal !== 'aal2';
}

export interface SignedIn {
    data: { user: User | null; aal: AssuranceLevel | null };
}

/**
 * The signed-in user, checked with the auth server (which also returns its factors), and how far
 * this session signed in. The token whose `aal` is read is the one the auth server just accepted.
 */
export async function getSignedIn(supabase: { auth: SupabaseClient['auth'] }): Promise<SignedIn> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { data: { user: null, aal: null } };
    const {
        data: { user },
    } = await supabase.auth.getUser(session.access_token);
    return { data: { user: user ?? null, aal: user ? assuranceLevel(session.access_token) : null } };
}

/** What someone typed or pasted as a code, digits only: "123 456" → "123456". */
export function cleanCode(input: string): string {
    return input.replace(/\D/g, '').slice(0, 6);
}

/** Why a typed code can't be sent yet, or null when it has 6 digits. */
export function codeProblem(code: string): string | null {
    if (!code) return 'Enter the 6-digit code from your authenticator app.';
    if (!/^\d{6}$/.test(code)) return 'Enter all 6 digits of the code.';
    return null;
}

const SIGN_IN_ENDED = ['session_not_found', 'session_expired', 'refresh_token_not_found', 'bad_jwt', 'no_authorization'];

/**
 * Supabase Auth's errors from setting up or checking a code, in plain words. `ended` means the sign-in
 * itself is gone (it expired, or every device was signed out): the person has to sign in again.
 */
export function codeError(
    err: unknown,
    fallback = "We couldn't check the code. Check your connection and try again."
): { message: string; wrongCode?: boolean; ended?: boolean } {
    const fields = typeof err === 'object' && err ? (err as { code?: unknown; status?: unknown; name?: unknown }) : {};
    const code = typeof fields.code === 'string' ? fields.code : '';
    if (code === 'mfa_verification_failed' || code === 'mfa_challenge_expired' || code === 'mfa_ip_address_mismatch') {
        return { message: "That code doesn't match. Enter the code your authenticator app shows now.", wrongCode: true };
    }
    if (code === 'over_request_rate_limit' || fields.status === 429) {
        return { message: 'Too many tries. Wait a few minutes, then try again.' };
    }
    if (code === 'mfa_totp_enroll_not_enabled' || code === 'mfa_totp_verify_not_enabled') {
        return {
            message: "Authenticator apps are turned off for this Gatekeep's Supabase project. Turn them on in its Authentication settings, then try again.",
        };
    }
    if (SIGN_IN_ENDED.includes(code) || fields.name === 'AuthSessionMissingError') {
        return { message: 'Your sign-in has ended. Sign in again.', ended: true };
    }
    return { message: fallback };
}
