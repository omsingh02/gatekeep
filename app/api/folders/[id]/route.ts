import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { sanitizeFolderName } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let user: any;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/folders/[id]', 'PATCH');
        if (user instanceof NextResponse) return user;

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

        let updateData: Record<string, any> = {};

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
            }

            updateData.parent_id = parentId || null;
        }

        // Prevent duplicates within the new parent if name changes
        if (updateData.name) {
            const parentForCheck = updateData.parent_id !== undefined ? updateData.parent_id : (folder as any).parent_id;
            const { data: conflict } = await adminClient
                .from('folders')
                .select('id')
                .eq('uploaded_by', user.id)
                .eq('name', updateData.name)
                .eq('parent_id', parentForCheck || null)
                .is('deleted_at', null)
                .neq('id', id)
                .maybeSingle();

            if (conflict) {
                return NextResponse.json({ error: 'A folder with that name already exists here', code: 'ERR_CONFLICT' }, { status: 409 });
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true, folder: {
                id: (folder as any).id,
                name: (folder as any).name,
                parentId: (folder as any).parent_id,
                uploadedBy: (folder as any).uploaded_by,
                createdAt: (folder as any).created_at,
                updatedAt: (folder as any).updated_at,
            } });
        }

        const { data: updated, error: updateError } = await adminClient
            .from('folders')
            .update(updateData as never)
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
        logError('/api/folders/[id]', user?.id, 'PATCH-folder', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDERS_PATCH' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let user: any;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/folders/[id]', 'DELETE');
        if (user instanceof NextResponse) return user;

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

        const { error: deleteError } = await adminClient
            .from('folders')
            .update({ deleted_at: deletedAt } as never)
            .eq('id', id);

        if (deleteError) {
            logError('/api/folders/[id]', user.id, 'delete-folder', deleteError);
            return NextResponse.json({ error: 'Failed to delete folder', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Detach files from this folder to avoid orphaned views
        await adminClient
            .from('files')
            .update({ folder_id: null } as never)
            .eq('folder_id', id)
            .is('deleted_at', null);

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('/api/folders/[id]', user?.id, 'DELETE-folder', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDERS_DELETE' }, { status: 500 });
    }
}
