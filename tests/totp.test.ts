import { describe, expect, it } from 'vitest';
import { base32Decode, totp, totpFromKey, wrongTotp } from '../e2e/totp';

// The e2e tests generate authenticator-app codes with this; check it against RFC 6238 Appendix B (SHA-1)
describe('e2e TOTP generator', () => {
    const key = Buffer.from('12345678901234567890', 'ascii');

    it('matches the RFC 6238 test vectors', () => {
        const vectors: [number, string][] = [
            [59, '94287082'],
            [1111111109, '07081804'],
            [1111111111, '14050471'],
            [1234567890, '89005924'],
            [2000000000, '69279037'],
            [20000000000, '65353130'],
        ];
        for (const [seconds, code] of vectors) {
            expect(totpFromKey(key, seconds * 1000, 8)).toBe(code);
            expect(totpFromKey(key, seconds * 1000)).toBe(code.slice(-6));
        }
    });

    it('decodes base32 setup keys', () => {
        expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString('ascii')).toBe('12345678901234567890');
        expect(totp('gezd gnbv gy3t qojq gezd gnbv gy3t qojq', 59_000)).toBe('287082');
    });

    it('can produce a code that is wrong right now', () => {
        const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
        const wrong = wrongTotp(secret);
        expect(wrong).toMatch(/^\d{6}$/);
        expect([-30_000, 0, 30_000].map((s) => totp(secret, Date.now() + s))).not.toContain(wrong);
    });
});
