import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { getSignedIn } from '@/lib/auth/twoFactor';
import { logError, logWarning } from '@/lib/utils/logger';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let userId: string | undefined;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await getSignedIn(supabase);
        const user = validateAuth(userData, '/api/folders/[id]/contents', 'GET');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const adminClient = createAdminClient();

        // Verify folder exists and belongs to user
        const { data: folder, error: folderError } = await adminClient
            .from('folders')
            .select('id, name, parent_id')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .single();

        if (folderError || !folder) {
            logWarning('/api/folders/[id]/contents', 'folder-not-found', 'Folder not found or unauthorized', {
                folderId: id.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Folder not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        // Get breadcrumb path
        const path: Array<{ id: string; name: string }> = [];
        let currentId: string | null = id;
        while (currentId) {
            const { data: pathFolder } = await adminClient
                .from('folders')
                .select('id, name, parent_id')
                .eq('id', currentId)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .single();

            if (!pathFolder) break;
            path.unshift({ id: pathFolder.id, name: pathFolder.name });
            currentId = pathFolder.parent_id;
        }

        // Get subfolders and files in parallel
        const [subfoldersResult, filesResult] = await Promise.all([
            adminClient
                .from('folders')
                .select('*')
                .eq('parent_id', id)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .order('name', { ascending: true }),
            adminClient
                .from('files')
                .select('*')
                .eq('folder_id', id)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .order('original_filename', { ascending: true }),
        ]);

        if (subfoldersResult.error) {
            logError('/api/folders/[id]/contents', user.id, 'fetch-subfolders', subfoldersResult.error);
            return NextResponse.json({ error: 'Failed to fetch subfolders', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        if (filesResult.error) {
            logError('/api/folders/[id]/contents', user.id, 'fetch-files', filesResult.error);
            return NextResponse.json({ error: 'Failed to fetch files', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Get subfolder stats (file count for each)
        const subfolderIds = (subfoldersResult.data || []).map((f) => f.id);
        const subfolderStats: Record<string, { fileCount: number; subfolderCount: number }> = {};

        if (subfolderIds.length > 0) {
            // Get file counts per subfolder
            for (const sfId of subfolderIds) {
                const [fileCount, subCount] = await Promise.all([
                    adminClient
                        .from('files')
                        .select('id', { count: 'exact', head: true })
                        .eq('folder_id', sfId)
                        .eq('uploaded_by', user.id)
                        .is('deleted_at', null),
                    adminClient
                        .from('folders')
                        .select('id', { count: 'exact', head: true })
                        .eq('parent_id', sfId)
                        .eq('uploaded_by', user.id)
                        .is('deleted_at', null),
                ]);
                subfolderStats[sfId] = {
                    fileCount: fileCount.count || 0,
                    subfolderCount: subCount.count || 0,
                };
            }
        }

        const subfolders = (subfoldersResult.data || []).map((f) => ({
            id: f.id,
            name: f.name,
            parentId: f.parent_id,
            uploadedBy: f.uploaded_by,
            createdAt: f.created_at,
            updatedAt: f.updated_at,
            fileCount: subfolderStats[f.id]?.fileCount || 0,
            subfolderCount: subfolderStats[f.id]?.subfolderCount || 0,
        }));

        const files = (filesResult.data || []).map((file) => ({
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
        }));

        return NextResponse.json({
            folder: {
                id: folder.id,
                name: folder.name,
                parentId: folder.parent_id,
            },
            path,
            subfolders,
            files,
            totalItems: subfolders.length + files.length,
        });
    } catch (error) {
        logError('/api/folders/[id]/contents', userId, 'GET-contents', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDER_CONTENTS' }, { status: 500 });
    }
}
