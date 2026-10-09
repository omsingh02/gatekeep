import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateFileMetadata } from '@/lib/utils/fileTypes';
import { sanitizeFilename } from '@/lib/utils/sanitization';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/api/http';
import { UPLOAD_PATH } from '@/lib/deliveries/uploads';
import { FILE_COLUMNS, loadOwnedFolder, serializeFile } from '@/lib/files/library';
import { FILE_MESSAGES } from '@/lib/files/rules';

const ROUTE = '/api/files/confirm';

/**
 * POST /api/files/confirm  { path, name, mimeType, folderId? } → 201 { file }
 *
 * Records a file uploaded with /api/files/presign. The size is read from storage, not trusted from the
 * browser, and the type, size and folder are checked again: if the file can't be kept, the stored copy
 * is removed. The file gets no link of its own: it's shared by adding it to a delivery.
 */
export async function POST(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    try {
        const body = await readJson(request);
        const { path, name, mimeType, folderId } = body;
        if (typeof path !== 'string' || !UPLOAD_PATH.test(path)) return jsonError(FILE_MESSAGES.uploadNotFinished, 400, 'ERR_INVALID_INPUT');
        if (typeof name !== 'string' || !name.trim() || typeof mimeType !== 'string' || !mimeType) {
            return jsonError(FILE_MESSAGES.chooseFile, 400, 'ERR_INVALID_INPUT');
        }

        const admin = createAdminClient();
        const { data: listed, error: listError } = await admin.storage.from('files').list('', { search: path, limit: 1 });
        if (listError) throw listError;
        const stored = listed?.find((entry) => entry.name === path);
        if (!stored) return jsonError(FILE_MESSAGES.uploadNotFinished, 400, 'ERR_NOT_UPLOADED');
        const discard = () => admin.storage.from('files').remove([path]);

        const size = Number((stored.metadata as { size?: number } | null)?.size ?? 0);
        const valid = validateFileMetadata(name, size, mimeType);
        if (!valid.valid) {
            await discard();
            return jsonError(valid.error ?? "This file can't be uploaded.", 400, 'ERR_INVALID_FILE');
        }

        // The folder may have been deleted while the file uploaded
        let folder: string | null = null;
        if (folderId !== undefined && folderId !== null) {
            const found = await loadOwnedFolder(user.id, folderId);
            if (!found) {
                await discard();
                return jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');
            }
            folder = found.id;
        }

        const { data: file, error } = await admin
            .from('files')
            .insert({
                filename: path,
                original_filename: sanitizeFilename(name),
                file_path: path,
                file_size: size,
                mime_type: mimeType,
                uploaded_by: user.id,
                folder_id: folder,
            })
            .select(FILE_COLUMNS)
            .single();
        if (error || !file) {
            await discard();
            throw error ?? new Error('Insert failed');
        }

        return NextResponse.json({ file: serializeFile(file) }, { status: 201 });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}
