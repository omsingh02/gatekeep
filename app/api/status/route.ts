import { NextResponse } from 'next/server';
import { requireOwner, serverError } from '@/lib/api/http';
import { systemStatus } from '@/lib/deliveries/status';

export const dynamic = 'force-dynamic';

/** GET /api/status: what's set up and what isn't, for the owner's System status page. */
export async function GET() {
    const user = await requireOwner('/api/status', 'GET');
    if (user instanceof NextResponse) return user;
    try {
        return NextResponse.json(await systemStatus(user), { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return serverError('/api/status', user.id, 'GET', err);
    }
}
