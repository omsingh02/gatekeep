import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOwner, serverError } from '@/lib/api/http';

const ROUTE = '/api/files/stats';

/** GET /api/files/stats → { fileCount, totalSize } (bytes), over every folder. */
export async function GET() {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        // Summed in the database: the database API returns at most 1,000 rows per request
        const { data, error } = await createAdminClient().rpc('gk_library_totals', { p_owner: user.id });
        if (error) throw error;
        const totals = data?.[0];

        return NextResponse.json({
            fileCount: Number(totals?.file_count ?? 0),
            totalSize: Number(totals?.total_size ?? 0),
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
