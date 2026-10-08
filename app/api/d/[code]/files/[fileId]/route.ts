import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordActivity } from '@/lib/deliveries/activity';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { isUuid, readJson, serverError } from '@/lib/deliveries/http';
import { requireRecipient, resolveDelivery } from '@/lib/deliveries/recipient-api';

type Params = { params: Promise<{ code: string; fileId: string }> };

/** Signed URLs live for a minute: long enough to start loading, too short to pass around. */
const URL_SECONDS = 60;

/**
 * POST /api/d/{code}/files/{fileId}  { action: 'preview' | 'download' }
 * Returns a short-lived URL. Only downloads count toward the recipient's download limit.
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
                  .select('files!inner(id, filename, original_filename, deleted_at)')
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

        const { data: signed, error } = await admin.storage
            .from('files')
            .createSignedUrl(file.filename, URL_SECONDS, isDownload ? { download: file.original_filename } : undefined);
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
            expiresInSeconds: URL_SECONDS,
            downloadCount,
            downloadsLeft: recipient.download_limit === null ? null : Math.max(recipient.download_limit - downloadCount, 0),
        });
    } catch (err) {
        return serverError('/api/d/[code]/files/[fileId]', undefined, 'POST', err);
    }
}
