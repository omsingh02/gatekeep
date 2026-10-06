import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Public health check for uptime monitors. 200 when the app can query the
 * database, 503 otherwise (e.g. the Supabase project is paused).
 */
export async function GET() {
    const startedAt = Date.now();
    const { error } = await createAdminClient().from('files').select('id').limit(1);
    const body = {
        status: error ? 'degraded' : 'ok',
        database: error ? 'unreachable' : 'up',
        latencyMs: Date.now() - startedAt,
    };
    return NextResponse.json(body, {
        status: error ? 503 : 200,
        headers: { 'Cache-Control': 'no-store' },
    });
}
