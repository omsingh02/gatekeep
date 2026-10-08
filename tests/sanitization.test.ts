import { describe, expect, it } from 'vitest';
import {
    sanitizeBoolean,
    sanitizeNumber,
    sanitizeShortCode,
    sanitizeUserIdentifier,
} from '@/lib/utils/sanitization';

describe('sanitizeShortCode', () => {
    it('keeps base62 codes unchanged', () => {
        expect(sanitizeShortCode('aB3xY9')).toBe('aB3xY9');
    });

    // Regression: legacy codes contain - and _; stripping them made those links unreachable
    it('keeps legacy - and _ characters', () => {
        expect(sanitizeShortCode('aB-x_9')).toBe('aB-x_9');
    });

    it('strips everything else', () => {
        expect(sanitizeShortCode('ab.cd')).toBe('abcd');
        expect(sanitizeShortCode('ab/../cd')).toBe('abcd');
        expect(sanitizeShortCode("ab'; drop")).toBe('abdrop');
    });

    it('caps length at 10', () => {
        expect(sanitizeShortCode('abcdefghijklmnop')).toBe('abcdefghij');
    });

    it('returns empty string for empty or non-string input', () => {
        expect(sanitizeShortCode('')).toBe('');
        expect(sanitizeShortCode(123 as unknown as string)).toBe('');
        expect(sanitizeShortCode(null as unknown as string)).toBe('');
    });
});

describe('sanitizeUserIdentifier', () => {
    it('lowercases so recipients are case-insensitive', () => {
        expect(sanitizeUserIdentifier('Maya@Acme.CO')).toBe('maya@acme.co');
        expect(sanitizeUserIdentifier('Studio-Wren')).toBe('studio-wren');
    });

    it('trims and collapses whitespace', () => {
        expect(sanitizeUserIdentifier('  john   wick  ')).toBe('john wick');
    });

    it('removes control characters and null bytes', () => {
        expect(sanitizeUserIdentifier('jo\u0000h\u0007n')).toBe('john');
    });

    it('keeps valid emails and rejects malformed ones', () => {
        expect(sanitizeUserIdentifier('user@example.com')).toBe('user@example.com');
        expect(sanitizeUserIdentifier('user@example')).toBe('');
        expect(sanitizeUserIdentifier('a b@example.com')).toBe('');
    });

    it('limits length', () => {
        expect(sanitizeUserIdentifier('x'.repeat(300))).toHaveLength(254);
        expect(sanitizeUserIdentifier('abcdef', 3)).toBe('abc');
    });

    it('returns empty string for empty or non-string input', () => {
        expect(sanitizeUserIdentifier('')).toBe('');
        expect(sanitizeUserIdentifier(undefined as unknown as string)).toBe('');
    });
});

describe('sanitizeNumber', () => {
    it('parses numeric input', () => {
        expect(sanitizeNumber('42')).toBe(42);
        expect(sanitizeNumber(3.5)).toBe(3.5);
    });

    it('returns null for non-numeric or non-finite input', () => {
        expect(sanitizeNumber('abc')).toBeNull();
        expect(sanitizeNumber(Infinity)).toBeNull();
        expect(sanitizeNumber(NaN)).toBeNull();
    });

    it('clamps to min and max', () => {
        expect(sanitizeNumber(-5, 0, 10)).toBe(0);
        expect(sanitizeNumber(50, 0, 10)).toBe(10);
        expect(sanitizeNumber(7, 0, 10)).toBe(7);
    });
});

describe('sanitizeBoolean', () => {
    it('passes booleans through', () => {
        expect(sanitizeBoolean(true)).toBe(true);
        expect(sanitizeBoolean(false)).toBe(false);
    });

    it('only treats the string "true" (any case) as true', () => {
        expect(sanitizeBoolean('true')).toBe(true);
        expect(sanitizeBoolean('TRUE')).toBe(true);
        expect(sanitizeBoolean('false')).toBe(false);
        expect(sanitizeBoolean('yes')).toBe(false);
    });

    it('falls back to truthiness for other types', () => {
        expect(sanitizeBoolean(1)).toBe(true);
        expect(sanitizeBoolean(0)).toBe(false);
        expect(sanitizeBoolean(null)).toBe(false);
    });
});
