import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid, jsonError, readJson, requireOwner, serverError } from '@/lib/deliveries/http';
import { deliveryDetail, loadOwnedDelivery, ownedFileIds, replaceDeliveryFiles } from '@/lib/deliveries/owner';
import type { Database } from '@/lib/types';

const ROUTE = '/api/deliveries/[id]';
type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = () => jsonError("That delivery doesn't exist.", 404, 'ERR_NOT_FOUND');

export async function GET(_request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const { id } = await params;
        if (!isUuid(id)) return NOT_FOUND();
        const delivery = await loadOwnedDelivery(user.id, id);
        if (!delivery) return NOT_FOUND();
        return NextResponse.json({ delivery: await deliveryDetail(delivery) });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}

/** PATCH { title?, message?, fileIds?, request?: { folderId?, maxFiles?, maxFileMb? } } */
export async function PATCH(request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'PATCH');
    if (user instanceof NextResponse) return user;
    try {
        const { id } = await params;
        if (!isUuid(id)) return NOT_FOUND();
        const delivery = await loadOwnedDelivery(user.id, id);
        if (!delivery) return NOT_FOUND();

        const body = await readJson(request);
        const update: Database['public']['Tables']['deliveries']['Update'] = {};

        if ('title' in body) {
            const title = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : '';
            if (!title) return jsonError('Give the delivery a title.', 400, 'ERR_INVALID_INPUT');
            if (title.length > 200) return jsonError('Keep the title under 200 characters.', 400, 'ERR_INVALID_INPUT');
            update.title = title;
        }
        if ('message' in body) {
            const message = typeof body.message === 'string' ? body.message.trim() : '';
            if (message.length > 2000) return jsonError('Keep the message under 2000 characters.', 400, 'ERR_INVALID_INPUT');
            update.message = message || null;
        }

        let fileIds: string[] | null = null;
        if ('fileIds' in body) {
            if (delivery.kind !== 'send') return jsonError("Requests don't have files to send.", 400, 'ERR_INVALID_INPUT');
            const result = await ownedFileIds(user.id, body.fileIds);
            if ('error' in result) return jsonError(result.error, 400, 'ERR_INVALID_INPUT');
            fileIds = result.ids;
        }

        if ('request' in body && delivery.kind === 'request') {
            const req = (body.request && typeof body.request === 'object' ? body.request : {}) as Record<string, unknown>;
            if ('folderId' in req) {
                if (req.folderId === null) update.request_folder_id = null;
                else {
                    const admin = createAdminClient();
                    const { data: folder } = isUuid(req.folderId)
                        ? await admin
                              .from('folders')
                              .select('id')
                              .eq('id', req.folderId)
                              .eq('uploaded_by', user.id)
                              .is('deleted_at', null)
                              .maybeSingle()
                        : { data: null };
                    if (!folder) return jsonError("That folder doesn't exist.", 400, 'ERR_INVALID_INPUT');
                    update.request_folder_id = folder.id;
                }
            }
            for (const [key, column, max] of [
                ['maxFiles', 'request_max_files', 500],
                ['maxFileMb', 'request_max_file_mb', 100],
            ] as const) {
                if (!(key in req)) continue;
                const value = req[key];
                if (value === null || value === '') {
                    update[column] = null;
                    continue;
                }
                const n = Number(value);
                if (!Number.isInteger(n) || n < 1 || n > max) {
                    return jsonError(
                        key === 'maxFiles' ? 'Allow between 1 and 500 files.' : 'The size limit must be between 1 and 100 MB.',
                        400,
                        'ERR_INVALID_INPUT',
                    );
                }
                update[column] = n;
            }
        }

        if (Object.keys(update).length === 0 && fileIds === null) {
            return jsonError('Nothing to change.', 400, 'ERR_INVALID_INPUT');
        }
        const admin = createAdminClient();
        if (Object.keys(update).length) {
            const { error } = await admin.from('deliveries').update(update).eq('id', delivery.id);
            if (error) throw error;
        }
        if (fileIds) await replaceDeliveryFiles(delivery.id, fileIds);

        const updated = await loadOwnedDelivery(user.id, delivery.id);
        return NextResponse.json({ delivery: await deliveryDetail(updated!) });
    } catch (err) {
        return serverError(ROUTE, user.id, 'PATCH', err);
    }
}

/** Deleting a delivery stops its link working for everyone. Files stay in Files. */
export async function DELETE(_request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'DELETE');
    if (user instanceof NextResponse) return user;
    try {
        const { id } = await params;
        if (!isUuid(id)) return NOT_FOUND();
        const delivery = await loadOwnedDelivery(user.id, id);
        if (!delivery) return NOT_FOUND();

        const admin = createAdminClient();
        const now = new Date().toISOString();
        await admin.from('deliveries').update({ deleted_at: now }).eq('id', delivery.id);
        await admin
            .from('delivery_recipients')
            .update({ session_expires_at: now, removed_at: now })
            .eq('delivery_id', delivery.id)
            .is('removed_at', null);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return serverError(ROUTE, user.id, 'DELETE', err);
    }
}
