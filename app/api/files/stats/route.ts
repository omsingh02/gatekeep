import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOwner, serverError } from '@/lib/api/http';

const ROUTE = '/api/files/stats';

/** GET /api/files/stats → { fileCount, totalSize } (bytes), over every folder. */
export async function GET() {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const { data, count, error } = await createAdminClient()
            .from('files')
            .select('file_size', { count: 'exact' })
            .eq('uploaded_by', user.id)
            .is('deleted_at', null);
        if (error) throw error;

        return NextResponse.json({
            fileCount: count ?? 0,
            totalSize: (data ?? []).reduce((sum, file) => sum + (file.file_size || 0), 0),
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
