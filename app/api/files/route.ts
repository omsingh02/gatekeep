import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

export async function GET(request: NextRequest) {
    try {
        // Verify admin authentication
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit');
        const limitNum = limit ? parseInt(limit, 10) : null;

        // Get files from database with count in single query
        const adminClient = createAdminClient();
        
        let query = adminClient
            .from('files')
            .select('*', { count: 'exact' })
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        
        if (limitNum && limitNum > 0) {
            query = query.limit(limitNum);
        }
        
        const { data: files, count: totalCount, error } = await query;

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
        }

        // Transform to camelCase
        const transformedFiles = (files || []).map((file: any) => ({
            id: file.id,
            filename: file.filename,
            originalFilename: file.original_filename,
            filePath: file.file_path,
            fileSize: file.file_size,
            mimeType: file.mime_type,
            shortCode: file.short_code,
            uploadedBy: file.uploaded_by,
            createdAt: file.created_at,
            updatedAt: file.updated_at,
            shortUrl: `${env.app.url}/${file.short_code}`,
        }));

        return NextResponse.json({ files: transformedFiles, totalCount: totalCount || 0 });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
