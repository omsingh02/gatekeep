import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError, logInfo } from '@/lib/utils/logger';
import { runDailyJobs } from '@/lib/deliveries/daily';

export const dynamic = 'force-dynamic';

/**
 * Daily Vercel Cron job (see vercel.json). Runs a tiny query so the Supabase free-tier project is
 * never paused for inactivity, then the daily jobs: "access ending soon" emails, removing old
 * email codes, and owner emails for request uploads nobody was told about yet.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is rejected.
 */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    const { error } = await createAdminClient().from('files').select('id').limit(1);
    const latencyMs = Date.now() - startedAt;

    if (error) {
        logError('/api/cron/keep-alive', undefined, 'db-ping', error, { latencyMs });
        return NextResponse.json({ ok: false, error: 'Database unreachable' }, { status: 503 });
    }

    logInfo('/api/cron/keep-alive', 'db-ping', { latencyMs });
    const jobs = await runDailyJobs();
    logInfo('/api/cron/keep-alive', 'daily-jobs', jobs);
    return NextResponse.json({ ok: true, latencyMs, ...jobs });
}
