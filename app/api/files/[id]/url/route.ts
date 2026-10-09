import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/utils/logger';
import { isUuid, jsonError, requireOwner, serverError } from '@/lib/api/http';
import { FILE_MESSAGES } from '@/lib/files/rules';
import { signedUrlSeconds } from '@/lib/utils/signedUrls';

const ROUTE = '/api/files/[id]/url';
const NOT_FOUND = () => jsonError(FILE_MESSAGES.fileNotFound, 404, 'ERR_NOT_FOUND');

/**
 * GET /api/files/{id}/url?action=preview|download → { url, expiresIn }
 *
 * Owner-only: a signed URL for one of the owner's own files, to preview it in the dashboard or
 * download it. It lives for a minute, or 15 minutes to preview video and audio (see
 * lib/utils/signedUrls.ts). Recipients never use this route (they go through their delivery).
 * `download` sets Content-Disposition so the browser saves the file under its name.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const { id } = await params;
        const action = request.nextUrl.searchParams.get('action') ?? 'preview';
        if (action !== 'preview' && action !== 'download') return jsonError(FILE_MESSAGES.chooseAction, 400, 'ERR_INVALID_INPUT');

        if (!isUuid(id)) return NOT_FOUND();
        // The storage path is only read here, never returned
        const { data: file, error: fileError } = await createAdminClient()
            .from('files')
            .select('id, filename, original_filename, mime_type')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .maybeSingle();
        if (fileError) throw fileError;
        if (!file) return NOT_FOUND();

        const seconds = signedUrlSeconds(action, file.mime_type);
        const { data: signed, error } = await createAdminClient()
            .storage.from('files')
            .createSignedUrl(file.filename, seconds, { download: action === 'download' ? file.original_filename : undefined });
        if (error || !signed) {
            logError(ROUTE, user.id, 'create-signed-url', error, { fileId: file.id.substring(0, 8) });
            return jsonError(FILE_MESSAGES.fileNotOpened, 502, 'ERR_STORAGE');
        }

        return NextResponse.json({ url: signed.signedUrl, expiresIn: seconds });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}
