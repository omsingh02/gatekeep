import { createAdminClient } from '@/lib/supabase/admin';
import type { ActivityType, Tables } from '@/lib/types';
import { ACTIVITY_LABELS, ANYONE_LABEL, REASON_LABELS } from './labels';

const TYPES = Object.keys(ACTIVITY_LABELS) as ActivityType[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActivityFilters {
    deliveryId?: string;
    recipientId?: string;
    types?: ActivityType[];
    from?: string;
    to?: string;
}

/** Parse ?delivery=&recipient=&type=a,b&from=&to= */
export function parseActivityFilters(params: URLSearchParams): { filters: ActivityFilters } | { error: string } {
    const filters: ActivityFilters = {};
    const delivery = params.get('delivery');
    if (delivery) {
        if (!UUID.test(delivery)) return { error: "That delivery doesn't exist." };
        filters.deliveryId = delivery;
    }
    const recipient = params.get('recipient');
    if (recipient) {
        if (!UUID.test(recipient)) return { error: "That person isn't on any delivery." };
        filters.recipientId = recipient;
    }
    const type = params.get('type');
    if (type) {
        const types = type.split(',').map((t) => t.trim()) as ActivityType[];
        if (types.some((t) => !TYPES.includes(t))) return { error: 'Unknown activity type.' };
        filters.types = types;
    }
    for (const key of ['from', 'to'] as const) {
        const value = params.get(key);
        if (!value) continue;
        const t = new Date(value).getTime();
        if (Number.isNaN(t)) return { error: `"${key}" isn't a valid date.` };
        filters[key] = new Date(t).toISOString();
    }
    return { filters };
}

export function encodeCursor(row: Pick<Tables<'activity'>, 'created_at' | 'id'>): string {
    return Buffer.from(`${row.created_at}|${row.id}`).toString('base64url');
}

export function decodeCursor(cursor: string | null): { createdAt: string; id: string } | null {
    if (!cursor) return null;
    try {
        const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|');
        if (!createdAt || !UUID.test(id ?? '') || Number.isNaN(new Date(createdAt).getTime())) return null;
        return { createdAt, id };
    } catch {
        return null;
    }
}

export interface ActivityItem {
    id: string;
    type: ActivityType;
    typeLabel: string;
    reason: string | null;
    reasonLabel: string | null;
    actor: string;
    deliveryId: string | null;
    deliveryTitle: string | null;
    fileId: string | null;
    fileName: string | null;
    recipientId: string | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: string;
}

/** One page of the owner's activity, newest first. */
export async function listActivity(
    ownerId: string,
    filters: ActivityFilters,
    options: { cursor?: string | null; limit: number },
): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
    const admin = createAdminClient();
    let query = admin
        .from('activity')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(options.limit + 1);
    if (filters.deliveryId) query = query.eq('delivery_id', filters.deliveryId);
    if (filters.recipientId) query = query.eq('recipient_id', filters.recipientId);
    if (filters.types?.length) query = query.in('type', filters.types);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);
    const cursor = decodeCursor(options.cursor ?? null);
    if (cursor) {
        query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const page = rows.slice(0, options.limit);

    const deliveryIds = [...new Set(page.map((r) => r.delivery_id).filter((id): id is string => Boolean(id)))];
    const fileIds = [...new Set(page.map((r) => r.file_id).filter((id): id is string => Boolean(id)))];
    const [{ data: deliveries }, { data: files }] = await Promise.all([
        deliveryIds.length ? admin.from('deliveries').select('id, title').in('id', deliveryIds) : Promise.resolve({ data: [] }),
        fileIds.length ? admin.from('files').select('id, original_filename').in('id', fileIds) : Promise.resolve({ data: [] }),
    ]);
    const titles = new Map((deliveries ?? []).map((d: { id: string; title: string }) => [d.id, d.title]));
    const names = new Map((files ?? []).map((f: { id: string; original_filename: string }) => [f.id, f.original_filename]));

    return {
        items: page.map((row) => ({
            id: row.id,
            type: row.type,
            typeLabel: ACTIVITY_LABELS[row.type],
            reason: row.reason,
            reasonLabel: row.reason ? REASON_LABELS[row.reason] : null,
            actor: row.actor || (row.recipient_id || row.type === 'denied' ? ANYONE_LABEL : 'You'),
            deliveryId: row.delivery_id,
            deliveryTitle: row.delivery_id ? (titles.get(row.delivery_id) ?? null) : null,
            fileId: row.file_id,
            fileName: row.file_id ? (names.get(row.file_id) ?? null) : null,
            recipientId: row.recipient_id,
            ip: row.ip,
            userAgent: row.user_agent,
            createdAt: row.created_at,
        })),
        nextCursor: rows.length > options.limit ? encodeCursor(page[page.length - 1]) : null,
    };
}
