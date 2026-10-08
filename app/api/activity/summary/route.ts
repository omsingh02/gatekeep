import { NextRequest, NextResponse } from 'next/server';
import { activitySummary, parseActivityFilters } from '@/lib/deliveries/activity-query';
import { jsonError, requireOwner, serverError } from '@/lib/deliveries/http';

const ROUTE = '/api/activity/summary';

/**
 * GET /api/activity/summary?delivery=&recipient=&from=&to=
 * → { opened, downloaded, denied, activeDeliveries, activeRecipients }
 * Totals for the whole period, counted in the database. `type` is ignored: the summary covers every event.
 */
export async function GET(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const parsed = parseActivityFilters(request.nextUrl.searchParams);
        if ('error' in parsed) return jsonError(parsed.error, 400, 'ERR_INVALID_INPUT');
        const { deliveryId, recipientId, from, to } = parsed.filters;
        return NextResponse.json(await activitySummary(user.id, { deliveryId, recipientId, from, to }), {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
