/**
 * Unified validation helpers to enforce "one way to do things"
 * These replace scattered validation patterns across routes
 */

import { NextResponse } from 'next/server';
import { isOwner } from '@/lib/auth/owner';
import { needsTwoFactorCode, TWO_FACTOR_REQUIRED, type AssuranceLevel } from '@/lib/auth/twoFactor';
import type { User } from '@supabase/supabase-js';
import { logWarning } from './logger';

/**
 * Validate that the request comes from the owner, fully signed in.
 * Returns the user, or the 401/403 NextResponse to send back:
 * - 401 without a signed-in account;
 * - 403 ERR_FORBIDDEN for an account that isn't the owner;
 * - 403 ERR_TWO_FACTOR_REQUIRED while an account with two-factor sign-in has only entered its password.
 *
 * Pass `getSignedIn(supabase)` (lib/auth/twoFactor.ts), which includes how far the session signed in.
 * Without `aal`, an account with two-factor sign-in is refused: it fails closed.
 *
 * Usage:
 *   const authCheck = validateAuth(await getSignedIn(supabase), route, 'GET');
 *   if (authCheck instanceof NextResponse) return authCheck;
 *   const user = authCheck;
 */
export function validateAuth(
    userData: { data: { user: User | null; aal?: AssuranceLevel | null } },
    route: string,
    method: string
): User | NextResponse {
    if (!userData?.data?.user) {
        logWarning(route, 'auth-required', `${method} request without authentication`);
        return NextResponse.json({ error: 'Sign in to continue.', code: 'ERR_UNAUTHORIZED' }, { status: 401 });
    }
    if (!isOwner(userData.data.user)) {
        logWarning(route, 'not-owner', `${method} request from a signed-in account that isn't the owner`);
        return NextResponse.json(
            { error: "This account doesn't have access to this Gatekeep.", code: 'ERR_FORBIDDEN' },
            { status: 403 }
        );
    }
    if (needsTwoFactorCode(userData.data.user, userData.data.aal)) {
        logWarning(route, 'two-factor-required', `${method} request from a session that hasn't entered its two-factor code`);
        return NextResponse.json(
            { error: 'Enter the code from your authenticator app to finish signing in.', code: TWO_FACTOR_REQUIRED },
            { status: 403 }
        );
    }
    return userData.data.user;
}
