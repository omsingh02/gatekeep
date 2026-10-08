import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { validateAuth, validateRequiredFields } from '@/lib/utils/validation';

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('validateAuth', () => {
    it('returns the user when it is the owner (app_metadata.role)', () => {
        const user = { id: 'u1', app_metadata: { role: 'owner' } } as unknown as User;
        expect(validateAuth({ data: { user } }, '/api/test', 'GET')).toBe(user);
    });

    it('accepts an owner listed in OWNER_EMAILS, case-insensitively', () => {
        vi.stubEnv('OWNER_EMAILS', 'someone@else.dev, Owner@Example.com');
        const user = { id: 'u2', email: 'owner@example.com', app_metadata: {} } as unknown as User;
        expect(validateAuth({ data: { user } }, '/api/test', 'GET')).toBe(user);
        vi.unstubAllEnvs();
    });

    it('returns a 403 for a signed-in account that is not the owner', async () => {
        vi.stubEnv('OWNER_EMAILS', 'owner@example.com');
        const user = { id: 'u3', email: 'stranger@example.com', app_metadata: {} } as unknown as User;
        const result = validateAuth({ data: { user } }, '/api/test', 'GET');
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: 'ERR_FORBIDDEN' });
        vi.unstubAllEnvs();
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
