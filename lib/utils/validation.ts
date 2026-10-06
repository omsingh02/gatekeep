/**
 * Unified validation helpers to enforce "one way to do things"
 * These replace scattered validation patterns across routes
 */

import { NextResponse } from 'next/server';
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

/**
 * Validate and sanitize a value using a sanitizer function
 * Returns the sanitized value, or a 400 NextResponse if invalid
 * 
 * Usage:
 *   const result = validateAndSanitize(input, sanitizeShortCode, '/api/route', 'short_code');
 *   if (result instanceof NextResponse) return result;
 *   const sanitized = result;
 */
export function validateAndSanitize(
    input: string | undefined,
    sanitizer: (input: string) => string,
    route: string,
    fieldName: string
): string | NextResponse {
    if (!input) {
        logWarning(route, 'validation-failed', `Missing ${fieldName}`);
        return NextResponse.json({ error: `Missing ${fieldName}`, code: 'ERR_INVALID_INPUT' }, { status: 400 });
    }

    const sanitized = sanitizer(input);
    if (!sanitized) {
        logWarning(route, 'sanitization-failed', `Invalid ${fieldName}`, {
            inputLength: input.length,
        });
        return NextResponse.json({ error: `Invalid ${fieldName}`, code: 'ERR_INVALID_INPUT' }, { status: 400 });
    }

    return sanitized;
}
