import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        const totalSize = (files || []).reduce((sum: number, file: any) => sum + (file.file_size || 0), 0);
        const fileIds = (files || []).map((f: any) => f.id);

        // Get total access grants (only if user has files)
        let totalAccess = 0;
        if (fileIds.length > 0) {
            const { count, error: accessError } = await adminClient
                .from('file_access')
                .select('*', { count: 'exact', head: true })
                .in('file_id', fileIds);
            if (!accessError) totalAccess = count || 0;
        }



        return NextResponse.json({
            totalFiles: totalFiles || 0,
            totalSize,
            totalAccess,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
