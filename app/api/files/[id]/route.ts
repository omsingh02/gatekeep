import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError, logWarning } from '@/lib/utils/logger';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/api/http';
import { FILE_COLUMNS, loadOwnedFile, loadOwnedFolder, serializeFile } from '@/lib/files/library';
import { FILE_MESSAGES, parseFileName } from '@/lib/files/rules';
import type { Database } from '@/lib/types';

const ROUTE = '/api/files/[id]';
type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = () => jsonError(FILE_MESSAGES.fileNotFound, 404, 'ERR_NOT_FOUND');

/** GET /api/files/{id} → { file } */
export async function GET(_request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const file = await loadOwnedFile(user.id, (await params).id);
        if (!file) return NOT_FOUND();
        return NextResponse.json({ file: serializeFile(file) });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}

/**
 * PATCH /api/files/{id}  { folderId?: string | null, name?: string } → { file }
 * Moves the file to another folder (null: All files) and/or renames it.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'PATCH');
    if (user instanceof NextResponse) return user;
    try {
        const file = await loadOwnedFile(user.id, (await params).id);
        if (!file) return NOT_FOUND();

        const body = await readJson(request);
        const update: Database['public']['Tables']['files']['Update'] = {};

        if ('folderId' in body) {
            if (body.folderId === null) update.folder_id = null;
            else {
                const folder = await loadOwnedFolder(user.id, body.folderId);
                if (!folder) return jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');
                update.folder_id = folder.id;
            }
        }

        if ('name' in body) {
            const name = parseFileName(body.name);
            if ('error' in name) return jsonError(name.error, 400, 'ERR_INVALID_INPUT');
            update.original_filename = name.value;
        }

        if (Object.keys(update).length === 0) return jsonError(FILE_MESSAGES.nothingToChange, 400, 'ERR_INVALID_INPUT');
        update.updated_at = new Date().toISOString();

        const { data: updated, error } = await createAdminClient()
            .from('files')
            .update(update)
            .eq('id', file.id)
            .eq('uploaded_by', user.id)
            .select(FILE_COLUMNS)
            .single();
        if (error || !updated) throw error ?? new Error('Update failed');

        return NextResponse.json({ file: serializeFile(updated) });
    } catch (err) {
        return serverError(ROUTE, user.id, 'PATCH', err);
    }
}

/**
 * DELETE /api/files/{id} → { ok: true }
 * Deliveries that include the file lose it. The row is marked deleted first, then the stored file
 * is removed, then the row.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'DELETE');
    if (user instanceof NextResponse) return user;
    try {
        const file = await loadOwnedFile(user.id, (await params).id);
        if (!file) return NOT_FOUND();

        const admin = createAdminClient();
        const { data, error } = await admin.rpc('soft_delete_file', { p_file_id: file.id, p_user_id: user.id });
        if (error) throw error;
        // It answers success with the stored file's name; otherwise it was deleted in the meantime
        const result = data?.[0];
        if (!result?.success || !result.filename) return NOT_FOUND();

        const { error: storageError } = await admin.storage.from('files').remove([result.filename]);
        if (storageError) {
            // The file is already gone from the owner's view; the stored copy can be cleaned up later
            logWarning(ROUTE, 'storage-deletion', 'Failed to delete from storage', { fileId: file.id.substring(0, 8) });
        }

        // The row is already marked deleted, so the file is gone for everyone even if this fails
        const { error: completeError } = await admin.rpc('complete_file_deletion', { p_file_id: file.id });
        if (completeError) logError(ROUTE, user.id, 'complete-file-deletion', completeError, { fileId: file.id.substring(0, 8) });

        return NextResponse.json({ ok: true });
    } catch (err) {
        return serverError(ROUTE, user.id, 'DELETE', err);
    }
}
