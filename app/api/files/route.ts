import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { validateAuth } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
    try {
        // Verify admin authentication
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/files', 'GET');
        if (user instanceof NextResponse) return user;

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit');
        const page = searchParams.get('page');
        const search = searchParams.get('search');
        const fileType = searchParams.get('fileType');
        const limitNum = limit ? parseInt(limit, 10) : 20; // Default 20 items per page
        const pageNum = page ? parseInt(page, 10) : 1;

        // Validate search input
        if (search && search.length > 100) {
            return NextResponse.json(
                { error: 'Search query too long', code: 'ERR_INVALID_INPUT' },
                { status: 400 }
            );
        }

        // Calculate offset for pagination
        const offset = (pageNum - 1) * limitNum;

        // Get files from database with count in single query
        const adminClient = createAdminClient();
        
        let query = adminClient
            .from('files')
            .select('*', { count: 'exact' })
            .eq('uploaded_by', user.id)
            .is('deleted_at', null);

        // Apply search filter (case-insensitive filename search)
        if (search && search.trim()) {
            const sanitized = search.trim().slice(0, 100);
            query = query.ilike('original_filename', `%${sanitized}%`);
        }

        // Apply file type filter
        if (fileType && fileType !== 'all') {
            switch (fileType) {
                case 'image':
                    query = query.like('mime_type', 'image/%');
                    break;
                case 'video':
                    query = query.like('mime_type', 'video/%');
                    break;
                case 'audio':
                    query = query.like('mime_type', 'audio/%');
                    break;
                case 'pdf':
                    query = query.eq('mime_type', 'application/pdf');
                    break;
                case 'document':
                    query = query.or('mime_type.like.application/msword*,mime_type.like.application/vnd.openxmlformats-officedocument*,mime_type.eq.text/plain,mime_type.eq.text/csv');
                    break;
                case 'archive':
                    query = query.or('mime_type.eq.application/zip,mime_type.eq.application/x-tar,mime_type.eq.application/gzip,mime_type.eq.application/x-rar-compressed,mime_type.eq.application/x-7z-compressed');
                    break;
            }
        }

        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limitNum - 1);
        
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

        // Calculate pagination metadata
        const totalPages = Math.ceil((totalCount || 0) / limitNum);

        return NextResponse.json({ 
            files: transformedFiles, 
            totalCount: totalCount || 0,
            page: pageNum,
            limit: limitNum,
            totalPages
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
