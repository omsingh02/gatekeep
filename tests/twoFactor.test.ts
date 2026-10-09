import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
    assuranceLevel,
    cleanCode,
    codeError,
    codeProblem,
    getSignedIn,
    hasTwoFactor,
    needsTwoFactorCode,
} from '@/lib/auth/twoFactor';

/** An unsigned token with the given claims: assuranceLevel only reads the payload. */
function token(claims: Record<string, unknown>): string {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.signature`;
}

const factor = (status: 'verified' | 'unverified') => ({ id: `f-${status}`, factor_type: 'totp', status }) as NonNullable<User['factors']>[number];

describe('hasTwoFactor', () => {
    it('is on only with a verified factor', () => {
        expect(hasTwoFactor({ factors: [factor('verified')] })).toBe(true);
        expect(hasTwoFactor({ factors: [factor('unverified')] })).toBe(false);
        expect(hasTwoFactor({ factors: [] })).toBe(false);
        expect(hasTwoFactor({})).toBe(false);
        expect(hasTwoFactor(null)).toBe(false);
    });
});

describe('assuranceLevel', () => {
    it('reads the aal claim', () => {
        expect(assuranceLevel(token({ sub: 'u1', aal: 'aal1' }))).toBe('aal1');
        expect(assuranceLevel(token({ sub: 'u1', aal: 'aal2' }))).toBe('aal2');
    });

    it('decodes base64url payloads that need padding or contain - and _', () => {
        // "~~~" and "???" in the claims produce "-"/"_" in base64url; odd lengths need padding
        expect(assuranceLevel(token({ aal: 'aal2', note: '~~~???>>>' }))).toBe('aal2');
        expect(assuranceLevel(token({ aal: 'aal2', n: 'x' }))).toBe('aal2');
    });

    it('is null for anything else', () => {
        expect(assuranceLevel(token({ aal: 'aal3' }))).toBeNull();
        expect(assuranceLevel(token({ sub: 'u1' }))).toBeNull();
        expect(assuranceLevel('not-a-token')).toBeNull();
        expect(assuranceLevel('a.!!!.c')).toBeNull();
        expect(assuranceLevel(undefined)).toBeNull();
    });
});

describe('needsTwoFactorCode', () => {
    const on = { factors: [factor('verified')] };
    const off = { factors: [factor('unverified')] };

    it('asks for the code until the session has it', () => {
        expect(needsTwoFactorCode(on, 'aal1')).toBe(true);
        expect(needsTwoFactorCode(on, 'aal2')).toBe(false);
    });

    it('fails closed when the level is unknown', () => {
        expect(needsTwoFactorCode(on, null)).toBe(true);
        expect(needsTwoFactorCode(on, undefined)).toBe(true);
    });

    it('never asks an account without two-factor sign-in', () => {
        expect(needsTwoFactorCode(off, 'aal1')).toBe(false);
        expect(needsTwoFactorCode(off, null)).toBe(false);
        expect(needsTwoFactorCode(null, null)).toBe(false);
    });
});

describe('getSignedIn', () => {
    const user = { id: 'u1', factors: [factor('verified')] } as unknown as User;

    function client(session: { access_token: string } | null, found: User | null) {
        const getUser = vi.fn().mockResolvedValue({ data: { user: found }, error: null });
        return {
            getUser,
            supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }), getUser } } as never,
        };
    }

    it('checks the session token with the auth server and returns its level', async () => {
        const access = token({ sub: 'u1', aal: 'aal1' });
        const { supabase, getUser } = client({ access_token: access }, user);
        expect(await getSignedIn(supabase)).toEqual({ data: { user, aal: 'aal1' } });
        expect(getUser).toHaveBeenCalledWith(access);
    });

    it('is signed out without a session, or when the auth server rejects the token', async () => {
        expect(await getSignedIn(client(null, null).supabase)).toEqual({ data: { user: null, aal: null } });
        expect(await getSignedIn(client({ access_token: token({ aal: 'aal2' }) }, null).supabase)).toEqual({ data: { user: null, aal: null } });
    });
});

describe('codes', () => {
    it('keeps digits only, at most 6', () => {
        expect(cleanCode('123 456')).toBe('123456');
        expect(cleanCode(' 12-34-56 ')).toBe('123456');
        expect(cleanCode('1234567')).toBe('123456');
        expect(cleanCode('abc')).toBe('');
    });

    it('says what is missing', () => {
        expect(codeProblem('')).toBe('Enter the 6-digit code from your authenticator app.');
        expect(codeProblem('12345')).toBe('Enter all 6 digits of the code.');
        expect(codeProblem('123456')).toBeNull();
    });

    it('turns Supabase errors into plain words', () => {
        expect(codeError({ code: 'mfa_verification_failed', status: 422 })).toEqual({
            message: "That code doesn't match. Enter the code your authenticator app shows now.",
            wrongCode: true,
        });
        expect(codeError({ code: 'mfa_challenge_expired' }).wrongCode).toBe(true);
        expect(codeError({ code: 'over_request_rate_limit', status: 429 }).message).toBe('Too many tries. Wait a few minutes, then try again.');
        expect(codeError({ status: 429 }).message).toBe('Too many tries. Wait a few minutes, then try again.');
        expect(codeError({ code: 'mfa_totp_enroll_not_enabled' }).message).toMatch(/^Authenticator apps are turned off/);
        expect(codeError({ code: 'session_not_found' })).toMatchObject({ ended: true });
        expect(codeError({ name: 'AuthSessionMissingError' })).toMatchObject({ ended: true });
        expect(codeError(new TypeError('Failed to fetch')).message).toBe("We couldn't check the code. Check your connection and try again.");
        expect(codeError(null, 'Fallback.').message).toBe('Fallback.');
    });

    it('never shows Supabase jargon', () => {
        const codes = ['mfa_verification_failed', 'over_request_rate_limit', 'mfa_totp_verify_not_enabled', 'session_expired', 'unknown'];
        for (const code of codes) {
            const { message } = codeError({ code, msg: 'Invalid TOTP code entered' });
            expect(message).not.toMatch(/\b(TOTP|AAL|aal\d|MFA)\b|factor\b(?<!two-factor)/i);
        }
    });
});
