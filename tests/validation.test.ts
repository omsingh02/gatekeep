import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { validateAndSanitize, validateAuth, validateRequiredFields } from '@/lib/utils/validation';
import { sanitizeShortCode } from '@/lib/utils/sanitization';

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('validateAuth', () => {
    it('returns the user when present', () => {
        const user = { id: 'u1' } as User;
        expect(validateAuth({ data: { user } }, '/api/test', 'GET')).toBe(user);
    });

    it('returns a 401 response when there is no user', async () => {
        const result = validateAuth({ data: { user: null } }, '/api/test', 'GET');
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ code: 'ERR_UNAUTHORIZED' });
    });
});

describe('validateRequiredFields', () => {
    it('returns null when every field is present', () => {
        expect(validateRequiredFields({ a: 1, b: 'x' }, ['a', 'b'], '/api/test')).toBeNull();
    });

    it('returns a 400 listing the missing fields', async () => {
        const res = validateRequiredFields({ a: 1, b: '' }, ['a', 'b', 'c'], '/api/test');
        expect(res?.status).toBe(400);
        expect(await res!.json()).toMatchObject({ error: 'Missing required fields: b, c', code: 'ERR_INVALID_INPUT' });
    });
});

describe('validateAndSanitize', () => {
    it('returns the sanitized value', () => {
        expect(validateAndSanitize('ab.cd', sanitizeShortCode, '/api/test', 'short_code')).toBe('abcd');
    });

    it('returns 400 for missing input', () => {
        const res = validateAndSanitize(undefined, sanitizeShortCode, '/api/test', 'short_code');
        expect((res as NextResponse).status).toBe(400);
    });

    it('returns 400 when sanitization leaves nothing', async () => {
        const res = validateAndSanitize('...', sanitizeShortCode, '/api/test', 'short_code') as NextResponse;
        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({ error: 'Invalid short_code' });
    });
});
