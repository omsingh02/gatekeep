import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { validateAuth } from '@/lib/utils/validation';
import { logError } from '@/lib/utils/logger';

/** The signed-in owner, or the 401/403 response to return. */
export async function requireOwner(route: string, method: string): Promise<User | NextResponse> {
    const supabase = await createClient();
    return validateAuth(await supabase.auth.getUser(), route, method);
}

export function jsonError(error: string, status: number, code?: string): NextResponse {
    return NextResponse.json(code ? { error, code } : { error }, { status });
}

export function serverError(route: string, userId: string | undefined, action: string, err: unknown): NextResponse {
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
