import { describe, expect, it } from 'vitest';
import { generateShortCode, isValidShortCode } from '@/lib/utils/shortCode';
import { sanitizeShortCode } from '@/lib/utils/sanitization';

describe('generateShortCode', () => {
    it('always returns 6 base62 characters', () => {
        for (let i = 0; i < 10_000; i++) {
            expect(generateShortCode()).toMatch(/^[0-9A-Za-z]{6}$/);
        }
    });

    // Regression: nanoid's default alphabet emitted - and _, and ~17% of links never resolved
    it('produces codes that survive sanitizeShortCode unchanged', () => {
        for (let i = 0; i < 10_000; i++) {
            const code = generateShortCode();
            expect(sanitizeShortCode(code)).toBe(code);
        }
    });

    it('is not trivially repetitive', () => {
        const codes = new Set(Array.from({ length: 1_000 }, generateShortCode));
        expect(codes.size).toBe(1_000);
    });
});

describe('isValidShortCode', () => {
    it('accepts 6 alphanumeric characters', () => {
        expect(isValidShortCode('aB3xY9')).toBe(true);
    });

    it('rejects wrong lengths and other characters', () => {
        expect(isValidShortCode('aB3xY')).toBe(false);
        expect(isValidShortCode('aB3xY90')).toBe(false);
        expect(isValidShortCode('aB-xY9')).toBe(false);
        expect(isValidShortCode('')).toBe(false);
    });
});
