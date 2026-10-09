import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, requireOwner, serverError } from '@/lib/api/http';
import {
    FILE_COLUMNS,
    FOLDER_COLUMNS,
    folderCounts,
    folderDetail,
    loadOwnedFolder,
    serializeFile,
    serializeFolder,
} from '@/lib/files/library';
import { FILE_MESSAGES } from '@/lib/files/rules';

const ROUTE = '/api/folders/[id]/contents';

/**
 * GET /api/folders/{id}/contents → { folder, folders, files }
 * The folder in full (as GET /api/folders/{id}), the folders inside it with their counts, and its files,
 * both by name.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const folder = await loadOwnedFolder(user.id, (await params).id);
        if (!folder) return jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');

        const admin = createAdminClient();
        const [detail, subfolders, files] = await Promise.all([
            folderDetail(user.id, folder),
            admin
                .from('folders')
                .select(FOLDER_COLUMNS)
                .eq('parent_id', folder.id)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .order('name', { ascending: true }),
            admin
                .from('files')
                .select(FILE_COLUMNS)
                .eq('folder_id', folder.id)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .order('original_filename', { ascending: true }),
        ]);
        if (subfolders.error) throw subfolders.error;
        if (files.error) throw files.error;

        const counts = await folderCounts(
            user.id,
            (subfolders.data ?? []).map((f) => f.id),
        );
        return NextResponse.json({
            folder: detail,
            folders: (subfolders.data ?? []).map((f) => ({ ...serializeFolder(f), ...counts.get(f.id)! })),
            files: (files.data ?? []).map(serializeFile),
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
