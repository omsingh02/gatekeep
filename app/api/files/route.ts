import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { getSignedIn } from '@/lib/auth/twoFactor';

export async function GET(request: NextRequest) {
    try {
        // Verify admin authentication
        const supabase = await createClient();
        const userData = await getSignedIn(supabase);
        const user = validateAuth(userData, '/api/files', 'GET');
        if (user instanceof NextResponse) return user;

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit');
        const page = searchParams.get('page');
        const search = searchParams.get('search');
        const fileType = searchParams.get('fileType');
        const dateFilter = searchParams.get('dateFilter');
        const folderId = searchParams.get('folderId');
        const showAll = searchParams.get('showAll') === 'true'; // For recent files view
        // Sort: name | size | modified (default); order: asc | desc (default)
        const sortColumns = { name: 'original_filename', size: 'file_size', modified: 'updated_at' } as const;
        const sortKey = searchParams.get('sort');
        const sortColumn = sortKey && sortKey in sortColumns ? sortColumns[sortKey as keyof typeof sortColumns] : 'updated_at';
        const ascending = searchParams.get('order') === 'asc';
        const limitNum = Math.min(Math.max(parseInt(limit || '', 10) || 20, 1), 100); // Bounded 1-100, default 20
        const pageNum = Math.max(parseInt(page || '', 10) || 1, 1); // Minimum 1

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

        if (folderId) {
            const { data: folder, error: folderError } = await adminClient
                .from('folders')
                .select('id')
                .eq('id', folderId)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .single();

            if (folderError || !folder) {
                return NextResponse.json({ error: 'Folder not found', code: 'ERR_FOLDER_NOT_FOUND' }, { status: 404 });
            }
        }
        
        let query = adminClient
            .from('files')
            .select(`
              id,
              filename,
              original_filename,
              file_path,
              file_size,
              mime_type,
              uploaded_by,
              created_at,
              updated_at,
              folder_id,
              folders!folder_id(id, name)
            `, { count: 'exact' })
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

        // Apply date filter
        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            let dateFrom: Date | null = null;

            switch (dateFilter) {
                case 'today':
                    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '3months':
                    dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
            }

            if (dateFrom) {
                query = query.gte('created_at', dateFrom.toISOString());
            }
        }

        // Filter by folder - Google Drive-like behavior
        // When showAll is false (default), filter to current folder level
        if (folderId) {
            query = query.eq('folder_id', folderId);
        } else if (!showAll && !search) {
            // At root level: only show files with no folder (unless searching or showing all)
            query = query.is('folder_id', null);
        }

        query = query
            .order(sortColumn, { ascending })
            // Tie-breaker so equal values never shuffle between pages
            .order('id', { ascending })
            .range(offset, offset + limitNum - 1);
        
        const { data: files, count: totalCount, error } = await query;

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
        }

        // Transform to camelCase
        const transformedFiles = (files || []).map((file) => ({
            id: file.id,
            filename: file.filename,
            originalFilename: file.original_filename,
            filePath: file.file_path,
            fileSize: file.file_size,
            mimeType: file.mime_type,
            uploadedBy: file.uploaded_by,
            createdAt: file.created_at,
            updatedAt: file.updated_at,
            folderId: file.folder_id,
            folderName: file.folders?.name || null,
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
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
