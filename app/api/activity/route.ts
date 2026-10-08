import { NextRequest, NextResponse } from 'next/server';
import { listActivity, parseActivityFilters } from '@/lib/deliveries/activity-query';
import { jsonError, requireOwner, serverError } from '@/lib/deliveries/http';

const ROUTE = '/api/activity';

/** GET /api/activity?delivery=&recipient=&type=opened,denied&from=&to=&cursor=&limit= */
export async function GET(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const params = request.nextUrl.searchParams;
        const parsed = parseActivityFilters(params);
        if ('error' in parsed) return jsonError(parsed.error, 400, 'ERR_INVALID_INPUT');
        const limit = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 100);
        return NextResponse.json(await listActivity(user.id, parsed.filters, { cursor: params.get('cursor'), limit }));
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
