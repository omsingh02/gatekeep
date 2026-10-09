import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/api/http';
import { FOLDER_COLUMNS, folderDetail, folderNameInUse, loadOwnedFolder, serializeFolder } from '@/lib/files/library';
import { FILE_MESSAGES, folderHasFolders, folderNameTaken, folderTooDeep, parseFolderName } from '@/lib/files/rules';
import type { Database } from '@/lib/types';

const ROUTE = '/api/folders/[id]';
type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = () => jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');

/** GET /api/folders/{id} → { folder } with fileCount, subfolderCount and path (breadcrumbs, ending with itself) */
export async function GET(_request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const folder = await loadOwnedFolder(user.id, (await params).id);
        if (!folder) return NOT_FOUND();
        return NextResponse.json({ folder: await folderDetail(user.id, folder) });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}

/**
 * PATCH /api/folders/{id}  { name?, parentId?: string | null } → { folder }
 * Renames the folder and/or moves it (null: to the top level). Folders are one level deep, so a folder
 * with folders inside stays at the top level. Its files move with it.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'PATCH');
    if (user instanceof NextResponse) return user;
    try {
        const folder = await loadOwnedFolder(user.id, (await params).id);
        if (!folder) return NOT_FOUND();

        const body = await readJson(request);
        const update: Database['public']['Tables']['folders']['Update'] = {};

        if ('name' in body) {
            const name = parseFolderName(body.name);
            if ('error' in name) return jsonError(name.error, 400, 'ERR_INVALID_INPUT');
            update.name = name.value;
        }
        const name = update.name ?? folder.name;

        if ('parentId' in body) {
            if (body.parentId === null) update.parent_id = null;
            else {
                if (body.parentId === folder.id) return jsonError(FILE_MESSAGES.folderIntoItself, 400, 'ERR_INVALID_INPUT');
                const parent = await loadOwnedFolder(user.id, body.parentId);
                if (!parent) return NOT_FOUND();
                if (parent.parent_id) return jsonError(folderTooDeep(name), 400, 'ERR_MAX_DEPTH');
                const { count, error } = await createAdminClient()
                    .from('folders')
                    .select('id', { count: 'exact', head: true })
                    .eq('parent_id', folder.id)
                    .eq('uploaded_by', user.id)
                    .is('deleted_at', null);
                if (error) throw error;
                if (count) return jsonError(folderHasFolders(name), 400, 'ERR_MAX_DEPTH');
                update.parent_id = parent.id;
            }
        }

        if (Object.keys(update).length === 0) return jsonError(FILE_MESSAGES.nothingToChange, 400, 'ERR_INVALID_INPUT');

        // Names are unique within a parent: check where the folder ends up, under the name it ends up with
        const parentId = update.parent_id !== undefined ? update.parent_id : folder.parent_id;
        if (await folderNameInUse(user.id, name, parentId, folder.id)) return jsonError(folderNameTaken(name), 409, 'ERR_CONFLICT');

        const { data: updated, error } = await createAdminClient()
            .from('folders')
            .update(update)
            .eq('id', folder.id)
            .eq('uploaded_by', user.id)
            .select(FOLDER_COLUMNS)
            .single();
        if (error || !updated) throw error ?? new Error('Update failed');

        return NextResponse.json({ folder: serializeFolder(updated) });
    } catch (err) {
        return serverError(ROUTE, user.id, 'PATCH', err);
    }
}

/**
 * DELETE /api/folders/{id} → { ok: true }
 * Deletes the folder and any folders inside it. Their files move to All files, so no delivery loses a file.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'DELETE');
    if (user instanceof NextResponse) return user;
    try {
        const folder = await loadOwnedFolder(user.id, (await params).id);
        if (!folder) return NOT_FOUND();

        const admin = createAdminClient();
        const ids = [folder.id];
        for (let i = 0; i < ids.length; i++) {
            const { data: children, error } = await admin
                .from('folders')
                .select('id')
                .eq('parent_id', ids[i])
                .eq('uploaded_by', user.id)
                .is('deleted_at', null);
            if (error) throw error;
            ids.push(...(children ?? []).map((child) => child.id));
        }

        const { error: filesError } = await admin
            .from('files')
            .update({ folder_id: null })
            .in('folder_id', ids)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null);
        if (filesError) throw filesError;

        const { error } = await admin
            .from('folders')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', ids)
            .eq('uploaded_by', user.id);
        if (error) throw error;

        return NextResponse.json({ ok: true });
    } catch (err) {
        return serverError(ROUTE, user.id, 'DELETE', err);
    }
}
