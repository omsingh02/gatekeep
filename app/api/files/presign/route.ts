import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { getFileExtension, validateFileMetadata } from '@/lib/utils/fileTypes';
import { logError, logWarning } from '@/lib/utils/logger';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/api/http';
import { loadOwnedFolder } from '@/lib/files/library';
import { FILE_MESSAGES } from '@/lib/files/rules';

const ROUTE = '/api/files/presign';

/**
 * POST /api/files/presign  { name, size, mimeType, folderId? } → { uploadUrl, path }
 *
 * Starts an upload: checks the file's type and size and the folder (null or left out: All files), then
 * returns a signed URL to PUT the file to. The file goes straight to storage, never through the app, so
 * the hosting platform's request size limit doesn't apply. Then POST /api/files/confirm with the path.
 */
export async function POST(request: NextRequest) {
    // 100 uploads per 10 minutes per IP (uploading a folder starts many at once)
    const identifier = getClientIdentifier(request);
    if (!rateLimit(identifier, 100, 10 * 60 * 1000).success) {
        logWarning(ROUTE, 'rate-limit', 'Upload rate limit exceeded', { identifier: identifier.substring(0, 15) });
        return jsonError(FILE_MESSAGES.tooManyUploads, 429, 'ERR_RATE_LIMIT');
    }

    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    try {
        const body = await readJson(request);
        const { name, size, mimeType, folderId } = body;
        if (typeof name !== 'string' || !name.trim() || typeof size !== 'number' || !(size >= 0) || typeof mimeType !== 'string' || !mimeType) {
            return jsonError(FILE_MESSAGES.chooseFile, 400, 'ERR_INVALID_INPUT');
        }

        const valid = validateFileMetadata(name, size, mimeType);
        if (!valid.valid) return jsonError(valid.error ?? "This file can't be uploaded.", 400, 'ERR_INVALID_FILE');

        if (folderId !== undefined && folderId !== null && !(await loadOwnedFolder(user.id, folderId))) {
            return jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');
        }

        // A new name in storage: `{timestamp}-{uuid}.{ext}` at the bucket root (lib/deliveries/uploads.ts → UPLOAD_PATH)
        const extension = getFileExtension(name);
        const path = `${Date.now()}-${randomUUID()}${extension ? `.${extension}` : ''}`;
        const { data, error } = await createAdminClient().storage.from('files').createSignedUploadUrl(path);
        if (error || !data) {
            logError(ROUTE, user.id, 'create-signed-upload-url', error);
            return jsonError(FILE_MESSAGES.uploadNotStarted, 502, 'ERR_STORAGE');
        }

        return NextResponse.json({ uploadUrl: data.signedUrl, path: data.path });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}
