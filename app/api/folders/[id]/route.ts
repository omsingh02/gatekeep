import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { sanitizeFolderName } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';
import type { Database } from '@/lib/types';

type AdminClient = ReturnType<typeof createAdminClient>;

// Helper: Get all descendant folder IDs recursively
async function getDescendantFolderIds(adminClient: AdminClient, folderId: string, userId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue = [folderId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const { data: children } = await adminClient
            .from('folders')
            .select('id')
            .eq('parent_id', currentId)
            .eq('uploaded_by', userId)
            .is('deleted_at', null);

        if (children) {
            for (const child of children) {
                descendants.push(child.id);
                queue.push(child.id);
            }
        }
    }

    return descendants;
}

// Helper: Check if targetId is a descendant of folderId (would cause circular reference)
async function isDescendant(adminClient: AdminClient, folderId: string, targetId: string, userId: string): Promise<boolean> {
    const descendants = await getDescendantFolderIds(adminClient, folderId, userId);
    return descendants.includes(targetId);
}

// Helper: Get folder path/breadcrumbs
async function getFolderPath(adminClient: AdminClient, folderId: string, userId: string): Promise<Array<{ id: string; name: string }>> {
    const path: Array<{ id: string; name: string }> = [];
    let currentId: string | null = folderId;

    while (currentId) {
        const { data: folder } = await adminClient
            .from('folders')
            .select('id, name, parent_id')
            .eq('id', currentId)
            .eq('uploaded_by', userId)
            .is('deleted_at', null)
            .single();

        if (!folder) break;

        path.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_id;
    }

    return path;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let userId: string | undefined;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/folders/[id]', 'GET');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const adminClient = createAdminClient();

        const { data: folder, error: folderError } = await adminClient
            .from('folders')
            .select('*')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .single();

        if (folderError || !folder) {
            logWarning('/api/folders/[id]', 'folder-not-found', 'Folder not found or unauthorized', {
                folderId: id.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Folder not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        // Get folder stats
        const [subfolderCount, fileCount, path] = await Promise.all([
            adminClient
                .from('folders')
                .select('id', { count: 'exact', head: true })
                .eq('parent_id', id)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null),
            adminClient
                .from('files')
                .select('id', { count: 'exact', head: true })
                .eq('folder_id', id)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null),
            getFolderPath(adminClient, id, user.id),
        ]);

        return NextResponse.json({
            folder: {
                id: folder.id,
                name: folder.name,
                parentId: folder.parent_id,
                uploadedBy: folder.uploaded_by,
                createdAt: folder.created_at,
                updatedAt: folder.updated_at,
                subfolderCount: subfolderCount.count || 0,
                fileCount: fileCount.count || 0,
                path,
            },
        });
    } catch (error) {
        logError('/api/folders/[id]', userId, 'GET-folder', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDERS_GET' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let userId: string | undefined;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/folders/[id]', 'PATCH');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const body = await request.json();
        const { name, parentId } = body || {};

        const adminClient = createAdminClient();

        const { data: folder, error: folderError } = await adminClient
            .from('folders')
            .select('*')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .single();

        if (folderError || !folder) {
            logWarning('/api/folders/[id]', 'folder-not-found', 'Folder not found or unauthorized', {
                folderId: id.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Folder not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const updateData: Database['public']['Tables']['folders']['Update'] = {};

        if (name !== undefined) {
            const sanitizedName = sanitizeFolderName(name || '');
            if (!sanitizedName) {
                return NextResponse.json({ error: 'Invalid folder name', code: 'ERR_INVALID_INPUT' }, { status: 400 });
            }
            updateData.name = sanitizedName;
        }

        if (parentId !== undefined) {
            if (parentId === id) {
                return NextResponse.json({ error: 'Folder cannot be its own parent', code: 'ERR_INVALID_INPUT' }, { status: 400 });
            }

            if (parentId) {
                const { data: parent, error: parentError } = await adminClient
                    .from('folders')
                    .select('id, parent_id')
                    .eq('id', parentId)
                    .eq('uploaded_by', user.id)
                    .is('deleted_at', null)
                    .single();

                if (parentError || !parent) {
                    return NextResponse.json({ error: 'Parent folder not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
                }

                // Limit to 1 level of nesting: parent cannot have a parent
                if (parent.parent_id) {
                    return NextResponse.json({ error: 'Cannot move folder inside a subfolder. Maximum folder depth is 1 level.', code: 'ERR_MAX_DEPTH' }, { status: 400 });
                }

                // If this folder has children, it cannot be moved into another folder
                const { count: childCount } = await adminClient
                    .from('folders')
                    .select('id', { count: 'exact', head: true })
                    .eq('parent_id', id)
                    .eq('uploaded_by', user.id)
                    .is('deleted_at', null);

                if (childCount && childCount > 0) {
                    return NextResponse.json({ error: 'Cannot move folder with subfolders into another folder. Maximum folder depth is 1 level.', code: 'ERR_MAX_DEPTH' }, { status: 400 });
                }

                // Prevent circular reference: target parent cannot be a descendant
                const wouldCycle = await isDescendant(adminClient, id, parentId, user.id);
                if (wouldCycle) {
                    return NextResponse.json({ error: 'Cannot move folder into its own subfolder', code: 'ERR_CIRCULAR_REF' }, { status: 400 });
                }
            }

            updateData.parent_id = parentId || null;
        }

        // Prevent duplicates within the new parent if name changes
        if (updateData.name) {
            const parentForCheck = updateData.parent_id !== undefined ? updateData.parent_id : folder.parent_id;
            // .eq('parent_id', null) would compare against the string "null"; root needs IS NULL
            const siblings = adminClient
                .from('folders')
                .select('id')
                .eq('uploaded_by', user.id)
                .eq('name', updateData.name)
                .is('deleted_at', null)
                .neq('id', id);
            const { data: conflict } = await (parentForCheck
                ? siblings.eq('parent_id', parentForCheck)
                : siblings.is('parent_id', null)
            ).maybeSingle();

            if (conflict) {
                return NextResponse.json({ error: 'A folder with that name already exists here', code: 'ERR_CONFLICT' }, { status: 409 });
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true, folder: {
                id: folder.id,
                name: folder.name,
                parentId: folder.parent_id,
                uploadedBy: folder.uploaded_by,
                createdAt: folder.created_at,
                updatedAt: folder.updated_at,
            } });
        }

        const { data: updated, error: updateError } = await adminClient
            .from('folders')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError || !updated) {
            logError('/api/folders/[id]', user.id, 'update-folder', updateError);
            return NextResponse.json({ error: 'Failed to update folder', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({
            folder: {
                id: updated.id,
                name: updated.name,
                parentId: updated.parent_id,
                uploadedBy: updated.uploaded_by,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
            },
        });
    } catch (error) {
        logError('/api/folders/[id]', userId, 'PATCH-folder', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDERS_PATCH' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let userId: string | undefined;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/folders/[id]', 'DELETE');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const { searchParams } = new URL(request.url);
        const deleteContents = searchParams.get('deleteContents') === 'true';

        const adminClient = createAdminClient();

        const { data: folder, error: folderError } = await adminClient
            .from('folders')
            .select('id')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .single();

        if (folderError || !folder) {
            logWarning('/api/folders/[id]', 'folder-not-found', 'Folder not found or unauthorized', {
                folderId: id.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Folder not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const deletedAt = new Date().toISOString();

        // Get all descendant folder IDs
        const descendantIds = await getDescendantFolderIds(adminClient, id, user.id);
        const allFolderIds = [id, ...descendantIds];

        // Soft delete all folders (parent + descendants)
        const { error: deleteError } = await adminClient
            .from('folders')
            .update({ deleted_at: deletedAt })
            .in('id', allFolderIds);

        if (deleteError) {
            logError('/api/folders/[id]', user.id, 'delete-folder', deleteError);
            return NextResponse.json({ error: 'Failed to delete folder', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Handle files in deleted folders
        if (deleteContents) {
            // Soft delete all files in deleted folders
            await adminClient
                .from('files')
                .update({ deleted_at: deletedAt })
                .in('folder_id', allFolderIds)
                .is('deleted_at', null);
        } else {
            // Detach files from deleted folders (move to root)
            await adminClient
                .from('files')
                .update({ folder_id: null })
                .in('folder_id', allFolderIds)
                .is('deleted_at', null);
        }

        return NextResponse.json({
            success: true,
            deletedFolders: allFolderIds.length,
            contentsDeleted: deleteContents,
        });
    } catch (error) {
        logError('/api/folders/[id]', userId, 'DELETE-folder', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDERS_DELETE' }, { status: 500 });
    }
}
