import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/utils/ratelimit';
import { newDeliveryCode } from '@/lib/deliveries/codes';
import { serializeDeliverySummary } from '@/lib/deliveries/deliveries';
import { isUuid, jsonError, readJson, requireOwner, serverError } from '@/lib/deliveries/http';
import { addRecipients, deliveryDetail, ownedFileIds, replaceDeliveryFiles } from '@/lib/deliveries/owner';
import { getOwnerSettings, getSender } from '@/lib/deliveries/settings';
import { ANYONE_LABEL } from '@/lib/deliveries/labels';
import type { Database } from '@/lib/types';

const ROUTE = '/api/deliveries';

/**
 * GET /api/deliveries?kind=send|request&q=&limit=&offset=
 * Deliveries with recipient and activity totals, newest first.
 */
export async function GET(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const params = request.nextUrl.searchParams;
        const limit = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 100);
        const offset = Math.max(Number(params.get('offset')) || 0, 0);
        const kind = params.get('kind');
        const q = params.get('q')?.trim();

        const admin = createAdminClient();
        let query = admin
            .from('deliveries')
            .select('*', { count: 'exact' })
            .eq('owner_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (kind === 'send' || kind === 'request') query = query.eq('kind', kind);
        if (q) query = query.ilike('title', `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
        const { data: deliveries, count, error } = await query;
        if (error) throw error;

        const ids = (deliveries ?? []).map((d) => d.id);
        const [{ data: recipients }, { data: files }] = await Promise.all([
            ids.length
                ? admin
                      .from('delivery_recipients')
                      .select('delivery_id, kind, identifier, removed_at, ends_at, open_count, download_count, last_opened_at, created_at')
                      .order('created_at', { ascending: true })
                      .in('delivery_id', ids)
                : Promise.resolve({ data: [] as never[] }),
            ids.length
                ? admin.from('delivery_files').select('delivery_id').in('delivery_id', ids)
                : Promise.resolve({ data: [] as never[] }),
        ]);

        const now = Date.now();
        const items = (deliveries ?? []).map((delivery) => {
            const rows = (recipients ?? []).filter((r) => r.delivery_id === delivery.id);
            const active = rows.filter((r) => !r.removed_at && (!r.ends_at || new Date(r.ends_at).getTime() > now));
            return {
                ...serializeDeliverySummary(delivery),
                fileCount: (files ?? []).filter((f) => f.delivery_id === delivery.id).length,
                recipientCount: rows.filter((r) => !r.removed_at).length,
                activeRecipientCount: active.length,
                opens: rows.reduce((sum, r) => sum + r.open_count, 0),
                downloads: rows.reduce((sum, r) => sum + r.download_count, 0),
                lastOpenedAt: rows.map((r) => r.last_opened_at).filter(Boolean).sort().pop() ?? null,
                // First few people, for avatars in the list ("Anyone with the password" included)
                recipientPreview: rows
                    .filter((r) => !r.removed_at)
                    .slice(0, 3)
                    .map((r) => (r.kind === 'anyone' ? ANYONE_LABEL : (r.identifier ?? ''))),
                status: active.length > 0 ? 'active' : rows.length > 0 ? 'ended' : 'no_recipients',
            };
        });
        return NextResponse.json({ deliveries: items, total: count ?? items.length, limit, offset });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET-list', err);
    }
}

/**
 * POST /api/deliveries
 * { kind?, title, message?, fileIds?, people?: [{ identifier, identifierType?, method?, password?, endsAt?, downloadLimit? }],
 *   anyone?: { password?, endsAt?, downloadLimit? }, sendInvites?: boolean,
 *   request?: { folderId?, maxFiles?, maxFileMb? } }
 * Creates the delivery, its files and recipients in one call. Passwords come back once.
 */
export async function POST(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    if (!rateLimit(`deliveries:${user.id}`, 60, 60_000).success) {
        return jsonError('Too many changes at once. Wait a minute and try again.', 429, 'ERR_RATE_LIMIT');
    }

    const admin = createAdminClient();
    let createdId: string | null = null;
    try {
        const body = await readJson(request);
        const kind = body.kind === 'request' ? 'request' : 'send';

        const title = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : '';
        if (!title) return jsonError('Give the delivery a title.', 400, 'ERR_INVALID_INPUT');
        if (title.length > 200) return jsonError('Keep the title under 200 characters.', 400, 'ERR_INVALID_INPUT');

        const message = typeof body.message === 'string' ? body.message.trim() : '';
        if (message.length > 2000) return jsonError('Keep the message under 2000 characters.', 400, 'ERR_INVALID_INPUT');

        let fileIds: string[] = [];
        if (kind === 'send') {
            const result = await ownedFileIds(user.id, body.fileIds);
            if ('error' in result) return jsonError(result.error, 400, 'ERR_INVALID_INPUT');
            fileIds = result.ids;
        }

        const insert: Database['public']['Tables']['deliveries']['Insert'] = {
            owner_id: user.id,
            short_code: await newDeliveryCode(),
            kind,
            title,
            message: message || null,
        };
        if (kind === 'request') {
            const req = (body.request && typeof body.request === 'object' ? body.request : {}) as Record<string, unknown>;
            if (req.folderId !== undefined && req.folderId !== null) {
                if (!isUuid(req.folderId)) return jsonError("That folder doesn't exist.", 400, 'ERR_INVALID_INPUT');
                const { data: folder } = await admin
                    .from('folders')
                    .select('id')
                    .eq('id', req.folderId)
                    .eq('uploaded_by', user.id)
                    .is('deleted_at', null)
                    .maybeSingle();
                if (!folder) return jsonError("That folder doesn't exist.", 400, 'ERR_INVALID_INPUT');
                insert.request_folder_id = folder.id;
            }
            for (const [key, column, max] of [
                ['maxFiles', 'request_max_files', 500],
                ['maxFileMb', 'request_max_file_mb', 100],
            ] as const) {
                const value = req[key];
                if (value === undefined || value === null || value === '') continue;
                const n = Number(value);
                if (!Number.isInteger(n) || n < 1 || n > max) {
                    return jsonError(
                        key === 'maxFiles' ? 'Allow between 1 and 500 files.' : 'The size limit must be between 1 and 100 MB.',
                        400,
                        'ERR_INVALID_INPUT',
                    );
                }
                insert[column] = n;
            }
        }

        const [settings, sender] = await Promise.all([getOwnerSettings(user.id), getSender(user.id)]);

        const { data: delivery, error } = await admin.from('deliveries').insert(insert).select('*').single();
        if (error || !delivery) throw error ?? new Error('Insert failed');
        createdId = delivery.id;

        if (kind === 'send') await replaceDeliveryFiles(delivery.id, fileIds);

        let recipients: unknown[] = [];
        const people = Array.isArray(body.people) ? body.people : [];
        if (people.length || body.anyone) {
            const result = await addRecipients(
                delivery,
                settings,
                sender,
                { people, anyone: (body.anyone as Record<string, unknown>) ?? null, sendInvites: body.sendInvites !== false },
                request,
            );
            if ('error' in result) {
                await admin.from('deliveries').delete().eq('id', delivery.id);
                createdId = null;
                return jsonError(result.error, 400, 'ERR_INVALID_INPUT');
            }
            recipients = result.recipients;
        }

        const detail = await deliveryDetail(delivery);
        return NextResponse.json({ delivery: detail, recipients }, { status: 201 });
    } catch (err) {
        if (createdId) await admin.from('deliveries').delete().eq('id', createdId);
        return serverError(ROUTE, user.id, 'POST-create', err);
    }
}
