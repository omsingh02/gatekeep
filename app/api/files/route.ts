import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPastLastPage, jsonError, likeEscape, requireOwner, serverError } from '@/lib/api/http';
import { FILE_COLUMNS, loadOwnedFolder, serializeFile } from '@/lib/files/library';
import { FILE_MESSAGES, MAX_SEARCH } from '@/lib/files/rules';

const ROUTE = '/api/files';

const SORT_COLUMNS = { name: 'original_filename', size: 'file_size', modified: 'updated_at' } as const;

/**
 * GET /api/files?folderId=&all=true&search=&fileType=&sort=name|size|modified&order=asc|desc&page=&limit=
 * → { files, total, page, limit, totalPages }
 *
 * Without folderId: the files in All files (the top level). `all=true`, or a search, looks in every folder.
 * fileType: image | video | audio | pdf | document | archive (anything else: every type).
 * Newest first by default; page from 1, limit 1–100 (20 by default).
 */
export async function GET(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const params = request.nextUrl.searchParams;
        const search = params.get('search')?.trim() ?? '';
        if (search.length > MAX_SEARCH) return jsonError(FILE_MESSAGES.searchTooLong, 400, 'ERR_INVALID_INPUT');

        const folderId = params.get('folderId');
        if (folderId && !(await loadOwnedFolder(user.id, folderId))) {
            return jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');
        }

        const sort = params.get('sort');
        const sortColumn = sort && sort in SORT_COLUMNS ? SORT_COLUMNS[sort as keyof typeof SORT_COLUMNS] : 'updated_at';
        const ascending = params.get('order') === 'asc';
        const limit = Math.min(Math.max(parseInt(params.get('limit') ?? '', 10) || 20, 1), 100);
        const page = Math.max(parseInt(params.get('page') ?? '', 10) || 1, 1);
        const offset = (page - 1) * limit;

        const admin = createAdminClient();
        // The same filters for the page and, past the last page, for the total on its own
        const filtered = (head = false) => {
            let query = admin
                .from('files')
                .select(FILE_COLUMNS, { count: 'exact', head })
                .eq('uploaded_by', user.id)
                .is('deleted_at', null);

            if (search) query = query.ilike('original_filename', `%${likeEscape(search)}%`);

            switch (params.get('fileType')) {
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

            // A folder shows its own files; All files shows the top level, unless searching or asking for all
            if (folderId) query = query.eq('folder_id', folderId);
            else if (params.get('all') !== 'true' && !search) query = query.is('folder_id', null);
            return query;
        };

        let { data, count, error } = await filtered()
            .order(sortColumn, { ascending })
            // Tie-breaker so equal values never shuffle between pages
            .order('id', { ascending })
            .range(offset, offset + limit - 1);
        if (isPastLastPage(error)) {
            ({ count, error } = await filtered(true));
            data = [];
        }
        if (error) throw error;

        const total = count ?? 0;
        return NextResponse.json({
            files: (data ?? []).map(serializeFile),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
