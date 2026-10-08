import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError, logWarning } from '@/lib/utils/logger';
import { validateAuth } from '@/lib/utils/validation';
import { signedUrlSeconds } from '@/lib/utils/signedUrls';

/**
 * GET /api/files/[id]/url?action=preview|download
 *
 * Owner-only: a signed URL for one of the owner's own files, to preview it in the dashboard or
 * download it. It lives for a minute, or 15 minutes to preview video and audio (see
 * lib/utils/signedUrls.ts). Recipients never use this route (they go through their delivery).
 * `download` sets Content-Disposition so the browser saves the file under its original name.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let userId: string | undefined;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/files/[id]/url', 'GET');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const action = new URL(request.url).searchParams.get('action') ?? 'preview';
        if (action !== 'preview' && action !== 'download') {
            return NextResponse.json({ error: 'Use action=preview or action=download.', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const adminClient = createAdminClient();
        const { data: file } = await adminClient
            .from('files')
            .select('id, filename, original_filename, mime_type')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .maybeSingle();

        if (!file) {
            logWarning('/api/files/[id]/url', 'file-access', 'File not found or not owned by this account', {
                fileId: id.substring(0, 8),
            });
            return NextResponse.json({ error: "That file doesn't exist any more.", code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const seconds = signedUrlSeconds(action, file.mime_type);
        const { data: signed, error } = await adminClient.storage.from('files').createSignedUrl(file.filename, seconds, {
            download: action === 'download' ? file.original_filename : undefined,
        });

        if (error || !signed) {
            logError('/api/files/[id]/url', user.id, 'create-signed-url', error, { fileId: id.substring(0, 8) });
            return NextResponse.json(
                { error: "We couldn't open this file. Try again in a moment.", code: 'ERR_STORAGE' },
                { status: 502 }
            );
        }

        return NextResponse.json({ url: signed.signedUrl, expiresIn: seconds });
    } catch (error) {
        logError('/api/files/[id]/url', userId, 'GET-file-url', error);
        return NextResponse.json({ error: 'Something went wrong on our side. Try again.', code: 'ERR_FILE_URL' }, { status: 500 });
    }
}
