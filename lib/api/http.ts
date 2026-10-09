import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { validateAuth } from '@/lib/utils/validation';
import { getSignedIn } from '@/lib/auth/twoFactor';
import { logError } from '@/lib/utils/logger';

/**
 * Helpers every API route shares. The conventions they implement (auth, error shape and codes,
 * envelopes, pagination, ids) are written up in docs/ARCHITECTURE.md → API conventions.
 */

/** Every error response: a sentence written for people (docs/VOICE.md) and a stable code for programs. */
export interface ApiErrorBody {
    error: string;
    code: string;
}

/**
 * The signed-in owner, or the 401/403 response to return. The session is checked with the auth
 * server, and an account with two-factor sign-in must have entered its code in this session.
 */
export async function requireOwner(route: string, method: string): Promise<User | NextResponse> {
    const supabase = await createClient();
    return validateAuth(await getSignedIn(supabase), route, method);
}

export function jsonError(error: string, status: number, code: string): NextResponse<ApiErrorBody> {
    return NextResponse.json({ error, code }, { status });
}

/** Log an unexpected error and answer 500 ERR_SERVER, without internals. */
export function serverError(route: string, userId: string | undefined, action: string, err: unknown): NextResponse<ApiErrorBody> {
    logError(route, userId, action, err);
    return jsonError('Something went wrong on our side. Try again in a moment.', 500, 'ERR_SERVER');
}

/** Parse a JSON body; an empty or invalid body is treated as {}. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
    try {
        const body = await request.json();
        return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID.test(value);
}
