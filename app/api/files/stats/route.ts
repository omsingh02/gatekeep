import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { getSignedIn } from '@/lib/auth/twoFactor';

export async function GET() {
    try {
        const supabase = await createClient();
        const userData = await getSignedIn(supabase);
        const user = validateAuth(userData, '/api/files/stats', 'GET');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();

        // Get total files count and size (excluding soft-deleted)
        // Use count: 'exact' to get count in the same query
        const { data: files, count: totalFiles, error: filesError } = await adminClient
            .from('files')
            .select('id, file_size', { count: 'exact' })
            .eq('uploaded_by', user.id)
            .is('deleted_at', null);

        if (filesError) {
            return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
        }

        const totalSize = (files || []).reduce((sum, file) => sum + (file.file_size || 0), 0);

        return NextResponse.json({
            totalFiles: totalFiles || 0,
            totalSize,
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
