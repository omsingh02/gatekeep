import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordActivity } from '@/lib/deliveries/activity';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { isUuid, readJson, serverError } from '@/lib/api/http';
import { requireRecipient, resolveDelivery } from '@/lib/deliveries/recipient-api';
import { signedUrlSeconds } from '@/lib/utils/signedUrls';

type Params = { params: Promise<{ code: string; fileId: string }> };

/**
 * POST /api/d/{code}/files/{fileId}  { action: 'preview' | 'download' }
 * Returns a short-lived URL: a minute, or 15 minutes to preview video and audio (they stream in
 * ranges as they play and seek; see lib/utils/signedUrls.ts). Only downloads count toward the
 * recipient's download limit.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { code, fileId } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const { delivery } = resolved;

        const signedIn = await requireRecipient(request, delivery);
        if ('response' in signedIn) return signedIn.response;
        const { recipient, sender } = signedIn;

        const admin = createAdminClient();
        const { data: link } = isUuid(fileId)
            ? await admin
                  .from('delivery_files')
                  .select('files!inner(id, filename, original_filename, mime_type, deleted_at)')
                  .eq('delivery_id', delivery.id)
                  .eq('file_id', fileId)
                  .is('files.deleted_at', null)
                  .maybeSingle()
            : { data: null };
        if (!link) return NextResponse.json({ error: RECIPIENT_MESSAGES.fileNotInDelivery, code: 'ERR_NOT_FOUND' }, { status: 404 });
        const file = link.files;

        const body = await readJson(request);
        const isDownload = body.action === 'download';

        let downloadCount = recipient.download_count;
        if (isDownload) {
            const { data: counted } = await admin.rpc('gk_count_download', { p_recipient_id: recipient.id });
            if (counted === null || counted < 0) {
                await recordActivity({
                    ownerId: delivery.owner_id,
                    type: 'denied',
                    reason: 'download_limit',
                    deliveryId: delivery.id,
                    recipientId: recipient.id,
                    fileId: file.id,
                    actor: recipient.identifier,
                    request,
                    notify: false,
                });
                return NextResponse.json(
                    { error: RECIPIENT_MESSAGES.downloadLimit(sender.name), code: 'ERR_DOWNLOAD_LIMIT' },
                    { status: 403 },
                );
            }
            downloadCount = counted;
        }

        const seconds = signedUrlSeconds(isDownload ? 'download' : 'preview', file.mime_type);
        const { data: signed, error } = await admin.storage
            .from('files')
            .createSignedUrl(file.filename, seconds, isDownload ? { download: file.original_filename } : undefined);
        if (error || !signed) {
            return NextResponse.json({ error: RECIPIENT_MESSAGES.unavailable, code: 'ERR_STORAGE' }, { status: 502 });
        }

        await recordActivity({
            ownerId: delivery.owner_id,
            type: isDownload ? 'downloaded' : 'previewed',
            deliveryId: delivery.id,
            recipientId: recipient.id,
            fileId: file.id,
            actor: recipient.identifier,
            request,
        });

        return NextResponse.json({
            url: signed.signedUrl,
            expiresInSeconds: seconds,
            downloadCount,
            downloadsLeft: recipient.download_limit === null ? null : Math.max(recipient.download_limit - downloadCount, 0),
        });
    } catch (err) {
        return serverError('/api/d/[code]/files/[fileId]', undefined, 'POST', err);
    }
}
