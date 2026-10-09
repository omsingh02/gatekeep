import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordActivity } from '@/lib/deliveries/activity';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { serverError } from '@/lib/api/http';
import { requireRecipient, resolveDelivery } from '@/lib/deliveries/recipient-api';

/** Long enough for the browser to start fetching every file for the zip. */
const URL_SECONDS = 300;

/**
 * POST /api/d/{code}/download-all
 * Counts as one download and returns a URL per file; the browser builds the zip, so large
 * deliveries don't hit serverless time limits.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const { delivery } = resolved;
        if (delivery.kind !== 'send') {
            return NextResponse.json({ error: "This delivery doesn't have files to download.", code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const signedIn = await requireRecipient(request, delivery);
        if ('response' in signedIn) return signedIn.response;
        const { recipient, sender } = signedIn;

        const admin = createAdminClient();
        const { data: rows } = await admin
            .from('delivery_files')
            .select('position, files!inner(id, filename, original_filename, file_size, deleted_at)')
            .eq('delivery_id', delivery.id)
            .is('files.deleted_at', null)
            .order('position', { ascending: true });
        const files = (rows ?? []).map((r) => r.files);
        if (files.length === 0) {
            return NextResponse.json({ error: 'This delivery has no files right now.', code: 'ERR_EMPTY' }, { status: 404 });
        }

        const { data: counted } = await admin.rpc('gk_count_download', { p_recipient_id: recipient.id });
        if (counted === null || counted < 0) {
            await recordActivity({
                ownerId: delivery.owner_id,
                type: 'denied',
                reason: 'download_limit',
                deliveryId: delivery.id,
                recipientId: recipient.id,
                actor: recipient.identifier,
                request,
                notify: false,
            });
            return NextResponse.json({ error: RECIPIENT_MESSAGES.downloadLimit(sender.name), code: 'ERR_DOWNLOAD_LIMIT' }, { status: 403 });
        }

        const signed = await Promise.all(
            files.map(async (file) => {
                const { data } = await admin.storage
                    .from('files')
                    .createSignedUrl(file.filename, URL_SECONDS, { download: file.original_filename });
                return data ? { id: file.id, name: file.original_filename, size: file.file_size, url: data.signedUrl } : null;
            }),
        );
        if (signed.some((s) => s === null)) {
            return NextResponse.json({ error: RECIPIENT_MESSAGES.unavailable, code: 'ERR_STORAGE' }, { status: 502 });
        }

        await recordActivity({
            ownerId: delivery.owner_id,
            type: 'downloaded_all',
            deliveryId: delivery.id,
            recipientId: recipient.id,
            actor: recipient.identifier,
            request,
        });

        return NextResponse.json({
            zipName: `${delivery.title.replace(/[^\w\- .()]+/g, '').trim().slice(0, 80) || 'delivery'}.zip`,
            files: signed,
            expiresInSeconds: URL_SECONDS,
            downloadCount: counted,
            downloadsLeft: recipient.download_limit === null ? null : Math.max(recipient.download_limit - counted, 0),
        });
    } catch (err) {
        return serverError('/api/d/[code]/download-all', undefined, 'POST', err);
    }
}
