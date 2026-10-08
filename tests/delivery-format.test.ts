import { describe, expect, it } from 'vitest';
import { DELIVERY_STATUS, deliveryStatus, recipientPill } from '@/components/product/deliveries/format';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const inDays = (days: number) => new Date(NOW + days * 24 * 60 * 60 * 1000).toISOString();

describe('recipientPill', () => {
    it('shows an active delivery with a week left as Active, not a warning', () => {
        expect(recipientPill({ status: 'active', endsAt: inDays(7) }, NOW)).toEqual({ tone: 'success', label: 'Active' });
        expect(recipientPill({ status: 'active', endsAt: inDays(3.5) }, NOW).tone).toBe('success');
    });

    it('warns only in the last 3 days', () => {
        expect(recipientPill({ status: 'active', endsAt: inDays(2.5) }, NOW)).toEqual({ tone: 'warning', label: 'Ends in 3 days' });
        expect(recipientPill({ status: 'active', endsAt: inDays(1.5) }, NOW)).toEqual({ tone: 'warning', label: 'Ends in 2 days' });
        expect(recipientPill({ status: 'active', endsAt: inDays(0.5) }, NOW)).toEqual({ tone: 'warning', label: 'Ends today' });
    });

    it('keeps the other states', () => {
        expect(recipientPill({ status: 'active', endsAt: null }, NOW)).toEqual({ tone: 'success', label: 'Active' });
        expect(recipientPill({ status: 'ended', endsAt: inDays(-1) }, NOW)).toEqual({ tone: 'danger', label: 'Ended' });
        expect(recipientPill({ status: 'removed', endsAt: null }, NOW)).toEqual({ tone: 'neutral', label: 'Removed' });
        expect(recipientPill({ status: 'limit_reached', endsAt: null }, NOW).label).toBe('Download limit reached');
    });
});

describe('deliveryStatus', () => {
    it('is active while anyone can still open it, as in the Deliveries list', () => {
        expect(deliveryStatus([{ status: 'ended' }, { status: 'active' }])).toBe('active');
        // A reached download limit still lets people in to preview
        expect(deliveryStatus([{ status: 'removed' }, { status: 'limit_reached' }])).toBe('active');
    });

    it('has ended once every recipient has ended or been removed', () => {
        expect(deliveryStatus([{ status: 'ended' }, { status: 'ended' }])).toBe('ended');
        expect(deliveryStatus([{ status: 'removed' }, { status: 'ended' }])).toBe('ended');
        expect(deliveryStatus([{ status: 'removed' }])).toBe('ended');
    });

    it('has no people before anyone is added', () => {
        expect(deliveryStatus([])).toBe('no_recipients');
        expect(DELIVERY_STATUS.no_recipients).toEqual({ tone: 'neutral', label: 'No people' });
        expect(DELIVERY_STATUS.ended).toEqual({ tone: 'danger', label: 'Ended' });
    });
});
