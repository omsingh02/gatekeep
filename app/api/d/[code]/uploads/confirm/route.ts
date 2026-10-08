import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeFilename } from '@/lib/utils/sanitization';
import { recordActivity } from '@/lib/deliveries/activity';
import { readJson, serverError } from '@/lib/deliveries/http';
import { requireRecipient, resolveDelivery } from '@/lib/deliveries/recipient-api';
import { UPLOAD_PATH, uploadProblem } from '@/lib/deliveries/uploads';

/**
 * POST /api/d/{code}/uploads/confirm  { path, filename, mimeType }
 * Records a file the recipient uploaded. The size is read from storage, not trusted from the
 * browser. The file belongs to the owner and lands in the request's folder.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const { delivery } = resolved;

        const signedIn = await requireRecipient(request, delivery);
        if ('response' in signedIn) return signedIn.response;
        const { recipient } = signedIn;

        const body = await readJson(request);
        const path = typeof body.path === 'string' ? body.path : '';
        if (!UPLOAD_PATH.test(path)) {
            return NextResponse.json({ error: "That upload didn't finish. Try again.", code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const admin = createAdminClient();
        const { data: listed } = await admin.storage.from('files').list('', { search: path, limit: 1 });
        const stored = listed?.find((entry) => entry.name === path);
        if (!stored) {
            return NextResponse.json({ error: "That upload didn't finish. Try again.", code: 'ERR_NOT_UPLOADED' }, { status: 400 });
        }
        const { data: already } = await admin.from('files').select('id').eq('filename', path).maybeSingle();
        if (already) return NextResponse.json({ file: { id: already.id } });

        const size = Number((stored.metadata as { size?: number } | null)?.size ?? 0);
        const mimeType =
            (stored.metadata as { mimetype?: string } | null)?.mimetype || (typeof body.mimeType === 'string' ? body.mimeType : '');
        const problem = await uploadProblem(delivery, recipient, { filename: body.filename, size, mimeType });
        if (problem) {
            await admin.storage.from('files').remove([path]);
            return NextResponse.json({ error: problem, code: 'ERR_INVALID_FILE' }, { status: 400 });
        }

        const { data: file, error } = await admin
            .from('files')
            .insert({
                filename: path,
                original_filename: sanitizeFilename(body.filename as string),
                file_path: path,
                file_size: size,
                mime_type: mimeType,
                short_code: null,
                uploaded_by: delivery.owner_id,
                folder_id: delivery.request_folder_id,
                received_via_delivery_id: delivery.id,
                received_from_recipient_id: recipient.id,
            })
            .select('id, original_filename, file_size')
            .single();
        if (error || !file) {
            await admin.storage.from('files').remove([path]);
            throw error ?? new Error('Insert failed');
        }

        await recordActivity({
            ownerId: delivery.owner_id,
            type: 'uploaded',
            deliveryId: delivery.id,
            recipientId: recipient.id,
            fileId: file.id,
            actor: recipient.identifier,
            request,
            notify: false,
        });

        return NextResponse.json({ file: { id: file.id, name: file.original_filename, size: file.file_size } }, { status: 201 });
    } catch (err) {
        return serverError('/api/d/[code]/uploads/confirm', undefined, 'POST', err);
    }
}
