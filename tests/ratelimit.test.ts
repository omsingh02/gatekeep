import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getClientIdentifier, rateLimit, resetRateLimitStore } from '@/lib/utils/ratelimit';

describe('rateLimit', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        resetRateLimitStore();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows N requests in a window, then blocks', () => {
        for (let i = 0; i < 5; i++) {
            const result = rateLimit('ip-1', 5, 60_000);
            expect(result.success).toBe(true);
            expect(result.remaining).toBe(4 - i);
        }
        expect(rateLimit('ip-1', 5, 60_000)).toMatchObject({ success: false, remaining: 0 });
    });

    it('tracks identifiers independently', () => {
        for (let i = 0; i < 5; i++) rateLimit('ip-1', 5, 60_000);
        expect(rateLimit('ip-1', 5, 60_000).success).toBe(false);
        expect(rateLimit('ip-2', 5, 60_000).success).toBe(true);
    });

    it('resets once the window has passed', () => {
        for (let i = 0; i < 5; i++) rateLimit('ip-1', 5, 60_000);
        expect(rateLimit('ip-1', 5, 60_000).success).toBe(false);

        vi.advanceTimersByTime(60_001);
        expect(rateLimit('ip-1', 5, 60_000)).toMatchObject({ success: true, remaining: 4 });
    });
});

describe('getClientIdentifier', () => {
    it('uses the first x-forwarded-for address', () => {
        const req = new Request('https://x.test', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
        expect(getClientIdentifier(req)).toBe('203.0.113.7');
    });

    it('falls back to x-real-ip, then "unknown"', () => {
        expect(getClientIdentifier(new Request('https://x.test', { headers: { 'x-real-ip': '198.51.100.2' } }))).toBe('198.51.100.2');
        expect(getClientIdentifier(new Request('https://x.test'))).toBe('unknown');
    });
});
