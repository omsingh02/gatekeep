import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { validateAuth } from '@/lib/utils/validation';

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

    describe('two-factor sign-in', () => {
        const owner = (status: 'verified' | 'unverified') =>
            ({ id: 'u4', app_metadata: { role: 'owner' }, factors: [{ id: 'f1', factor_type: 'totp', status }] }) as unknown as User;

        it('returns a 403 while the session has only entered the password', async () => {
            const result = validateAuth({ data: { user: owner('verified'), aal: 'aal1' } }, '/api/test', 'GET');
            expect(result).toBeInstanceOf(NextResponse);
            const res = result as NextResponse;
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({
                error: 'Enter the code from your authenticator app to finish signing in.',
                code: 'ERR_TWO_FACTOR_REQUIRED',
            });
        });

        it('fails closed when the caller does not pass the level', () => {
            const result = validateAuth({ data: { user: owner('verified') } }, '/api/test', 'GET');
            expect((result as NextResponse).status).toBe(403);
        });

        it('lets the owner in after the code', () => {
            const user = owner('verified');
            expect(validateAuth({ data: { user, aal: 'aal2' } }, '/api/test', 'GET')).toBe(user);
        });

        it('ignores a setup that was never confirmed', () => {
            const user = owner('unverified');
            expect(validateAuth({ data: { user, aal: 'aal1' } }, '/api/test', 'GET')).toBe(user);
        });

        it('still answers ERR_FORBIDDEN for an account that is not the owner', async () => {
            const user = { id: 'u5', app_metadata: {}, factors: [{ id: 'f2', factor_type: 'totp', status: 'verified' }] } as unknown as User;
            const res = validateAuth({ data: { user, aal: 'aal1' } }, '/api/test', 'GET') as NextResponse;
            expect(res.status).toBe(403);
            expect(await res.json()).toMatchObject({ code: 'ERR_FORBIDDEN' });
        });
    });

    it('returns a 401 response when there is no user', async () => {
        const result = validateAuth({ data: { user: null } }, '/api/test', 'GET');
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ code: 'ERR_UNAUTHORIZED' });
    });
});
