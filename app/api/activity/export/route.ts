import { NextRequest, NextResponse } from 'next/server';
import { listActivity, parseActivityFilters, type ActivityItem } from '@/lib/deliveries/activity-query';
import { toCsv } from '@/lib/deliveries/csv';
import { jsonError, requireOwner, serverError } from '@/lib/deliveries/http';

const ROUTE = '/api/activity/export';
const MAX_ROWS = 50_000;

/** GET /api/activity/export?…same filters as /api/activity → CSV download */
export async function GET(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const parsed = parseActivityFilters(request.nextUrl.searchParams);
        if ('error' in parsed) return jsonError(parsed.error, 400, 'ERR_INVALID_INPUT');

        const items: ActivityItem[] = [];
        let cursor: string | null = null;
        do {
            const page = await listActivity(user.id, parsed.filters, { cursor, limit: 100 });
            items.push(...page.items);
            cursor = page.nextCursor;
        } while (cursor && items.length < MAX_ROWS);

        const csv = toCsv([
            ['Time (UTC)', 'Event', 'Reason', 'Person', 'Delivery', 'File', 'IP address', 'Browser', 'Request ID'],
            ...items.map((item) => [
                item.createdAt,
                item.typeLabel,
                item.reasonLabel,
                item.actor,
                item.deliveryTitle,
                item.fileName,
                item.ip,
                item.userAgent,
                item.requestId,
            ]),
        ]);
        const date = new Date().toISOString().slice(0, 10);
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="gatekeep-activity-${date}.csv"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
