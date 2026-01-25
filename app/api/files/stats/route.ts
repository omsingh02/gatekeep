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
        const { data: files, error: filesError } = await adminClient
            .from('files')
            .select('file_size')
            .eq('uploaded_by', user.id)
            .is('deleted_at', null);

        if (filesError) {
            return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
        }

        const totalFiles = files?.length || 0;
        const totalSize = (files || []).reduce((sum: number, file: any) => sum + (file.file_size || 0), 0);

        // Get total access grants
        const { count: totalAccess, error: accessError } = await adminClient
            .from('file_access')
            .select('*', { count: 'exact', head: true })
            .in('file_id', (files || []).map((f: any) => f.id) || []);



        return NextResponse.json({
            totalFiles,
            totalSize,
            totalAccess: totalAccess || 0,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
