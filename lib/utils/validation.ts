/**
 * Unified validation helpers to enforce "one way to do things"
 * These replace scattered validation patterns across routes
 */

import { NextResponse } from 'next/server';
import { isOwner } from '@/lib/auth/owner';
import type { User } from '@supabase/supabase-js';
import { logWarning } from './logger';

/**
 * Validate that user is authenticated
 * Returns the user object or a 401 NextResponse
 * 
 * Usage:
 *   const authCheck = validateAuth(userData, route, 'GET');
 *   if (authCheck instanceof NextResponse) return authCheck;
 *   const user = authCheck;
 */
export function validateAuth(
    userData: { data: { user: User | null } },
    route: string,
    method: string
): User | NextResponse {
    if (!userData?.data?.user) {
        logWarning(route, 'auth-required', `${method} request without authentication`);
        return NextResponse.json({ error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' }, { status: 401 });
    }
    if (!isOwner(userData.data.user)) {
        logWarning(route, 'not-owner', `${method} request from a signed-in account that isn't the owner`);
        return NextResponse.json(
            { error: "This account doesn't have access to this Gatekeep.", code: 'ERR_FORBIDDEN' },
            { status: 403 }
        );
    }
    return userData.data.user;
}

/**
 * Validate that required fields exist in request body
 * Returns null if valid, or a 400 NextResponse if invalid
 * 
 * Usage:
 *   const error = validateRequiredFields({ fileId, userIdentifier, password }, ['fileId', 'userIdentifier', 'password'], route);
 *   if (error) return error;
 */
export function validateRequiredFields(
    body: Record<string, unknown>,
    requiredFields: string[],
    route: string
): NextResponse | null {
    const missing = requiredFields.filter(field => !body[field]);

    if (missing.length > 0) {
        logWarning(route, 'validation-failed', 'Missing required fields', {
            missing: missing.join(','),
        });
        return NextResponse.json(
            { error: `Missing required fields: ${missing.join(', ')}`, code: 'ERR_INVALID_INPUT' },
            { status: 400 }
        );
    }

    return null;
}
