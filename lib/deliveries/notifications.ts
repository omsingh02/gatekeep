/**
 * Owner notifications. Rules (docs/decisions/0001-deliveries.md → Notifications):
 * - opened: first open per recipient per delivery per 24 h
 * - downloaded: every download (off by default)
 * - denied: one alert once 3 denials hit a delivery within 15 minutes, then quiet for 15 minutes
 * - uploaded: one email per batch of uploads (sent when the recipient finishes, or by the daily cron)
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/transport';
import { deniedEmail, downloadedEmail, openedEmail, uploadedEmail } from '@/lib/email/messages';
import type { Tables } from '@/lib/types';
import { adminUrl } from './format';
import { ANYONE_LABEL, REASON_LABELS } from './labels';
import { getOwnerEmail, getOwnerSettings } from './settings';

export const OPEN_DEDUPE_MS = 24 * 3600 * 1000;
export const DENIAL_WINDOW_MS = 15 * 60 * 1000;
export const DENIAL_THRESHOLD = 3;

export function shouldNotifyOpen(lastNotifiedOpenAt: string | null, now = Date.now()): boolean {
    return !lastNotifiedOpenAt || now - new Date(lastNotifiedOpenAt).getTime() >= OPEN_DEDUPE_MS;
}

export function shouldNotifyDenials(deniedInWindow: number, lastAlertAt: string | null, now = Date.now()): boolean {
    if (deniedInWindow < DENIAL_THRESHOLD) return false;
    return !lastAlertAt || now - new Date(lastAlertAt).getTime() >= DENIAL_WINDOW_MS;
}

function actorLabel(row: Pick<Tables<'activity'>, 'actor'>): string {
    return row.actor || ANYONE_LABEL;
}

async function markNotified(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await createAdminClient().from('activity').update({ notified_at: new Date().toISOString() }).in('id', ids);
}

export async function dispatchNotification(row: Tables<'activity'>): Promise<void> {
    if (!row.delivery_id) return;
    const admin = createAdminClient();
    const settings = await getOwnerSettings(row.owner_id);

    const wanted =
        (row.type === 'opened' && settings.notify_opened) ||
        ((row.type === 'downloaded' || row.type === 'downloaded_all') && settings.notify_downloaded) ||
        (row.type === 'denied' && settings.notify_denied);
    if (!wanted) return;

    const [ownerEmail, { data: delivery }] = await Promise.all([
        getOwnerEmail(row.owner_id),
        admin.from('deliveries').select('id, title').eq('id', row.delivery_id).maybeSingle(),
    ]);
    if (!ownerEmail || !delivery) return;

    const activityUrl = adminUrl(`/deliveries/${delivery.id}`);
    const settingsUrl = adminUrl('/settings');

    if (row.type === 'opened') {
        const { data: last } = await admin
            .from('activity')
            .select('notified_at')
            .eq('delivery_id', row.delivery_id)
            .eq('type', 'opened')
            .not('notified_at', 'is', null)
            .filter('recipient_id', row.recipient_id ? 'eq' : 'is', row.recipient_id ?? null)
            .order('notified_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!shouldNotifyOpen(last?.notified_at ?? null)) return;

        const recipient = row.recipient_id
            ? (await admin.from('delivery_recipients').select('download_count, download_limit').eq('id', row.recipient_id).maybeSingle()).data
            : null;
        const email = openedEmail({
            actor: actorLabel(row),
            title: delivery.title,
            at: row.created_at,
            ip: row.ip,
            downloads: recipient ? { used: recipient.download_count, limit: recipient.download_limit } : null,
            activityUrl,
            settingsUrl,
        });
        if (await sendEmail({ to: ownerEmail, ...email })) await markNotified([row.id]);
        return;
    }

    if (row.type === 'downloaded' || row.type === 'downloaded_all') {
        const [{ data: file }, { data: recipient }] = await Promise.all([
            row.file_id
                ? admin.from('files').select('original_filename').eq('id', row.file_id).maybeSingle()
                : Promise.resolve({ data: null }),
            row.recipient_id
                ? admin.from('delivery_recipients').select('download_count, download_limit').eq('id', row.recipient_id).maybeSingle()
                : Promise.resolve({ data: null }),
        ]);
        const email = downloadedEmail({
            actor: actorLabel(row),
            title: delivery.title,
            fileName: row.type === 'downloaded' ? (file?.original_filename ?? null) : null,
            at: row.created_at,
            downloads: { used: recipient?.download_count ?? 1, limit: recipient?.download_limit ?? null },
            activityUrl,
            settingsUrl,
        });
        if (await sendEmail({ to: ownerEmail, ...email })) await markNotified([row.id]);
        return;
    }

    if (row.type === 'denied') {
        const since = new Date(Date.now() - DENIAL_WINDOW_MS).toISOString();
        const { data: recent } = await admin
            .from('activity')
            .select('id, reason, ip, notified_at')
            .eq('delivery_id', row.delivery_id)
            .eq('type', 'denied')
            .gte('created_at', since);
        const rows = recent ?? [];
        const lastAlert = rows
            .map((r) => r.notified_at)
            .filter((t): t is string => Boolean(t))
            .sort()
            .pop() ?? null;
        if (!shouldNotifyDenials(rows.length, lastAlert)) return;

        const reasons = [...new Set(rows.map((r) => (r.reason ? REASON_LABELS[r.reason] : 'Denied')))];
        const ips = [...new Set(rows.map((r) => r.ip).filter((ip): ip is string => Boolean(ip)))];
        const email = deniedEmail({
            title: delivery.title,
            count: rows.length,
            minutes: DENIAL_WINDOW_MS / 60000,
            reasons,
            ips,
            activityUrl,
            settingsUrl,
        });
        if (await sendEmail({ to: ownerEmail, ...email })) await markNotified([row.id]);
    }
}

/**
 * One email for the files a recipient uploaded to a request that the owner hasn't heard about yet.
 * Pass olderThanMs to only include uploads that have settled (used by the daily cron).
 */
export async function notifyUploads(
    deliveryId: string,
    recipientId: string | null,
    options: { olderThanMs?: number } = {},
): Promise<number> {
    const admin = createAdminClient();
    let query = admin
        .from('activity')
        .select('id, owner_id, actor, file_id, created_at')
        .eq('delivery_id', deliveryId)
        .eq('type', 'uploaded')
        .is('notified_at', null);
    query = recipientId ? query.eq('recipient_id', recipientId) : query.is('recipient_id', null);
    if (options.olderThanMs) query = query.lt('created_at', new Date(Date.now() - options.olderThanMs).toISOString());
    const { data: rows } = await query;
    if (!rows || rows.length === 0) return 0;

    const ownerId = rows[0].owner_id;
    const settings = await getOwnerSettings(ownerId);
    if (!settings.notify_uploaded) {
        await markNotified(rows.map((r) => r.id)); // don't keep them pending forever
        return 0;
    }

    const [ownerEmail, { data: delivery }, { data: files }] = await Promise.all([
        getOwnerEmail(ownerId),
        admin.from('deliveries').select('id, title, request_folder_id').eq('id', deliveryId).maybeSingle(),
        admin
            .from('files')
            .select('id, original_filename')
            .in('id', rows.map((r) => r.file_id).filter((id): id is string => Boolean(id))),
    ]);
    if (!ownerEmail || !delivery) return 0;

    const folder = delivery.request_folder_id
        ? (await admin.from('folders').select('name').eq('id', delivery.request_folder_id).maybeSingle()).data
        : null;

    const email = uploadedEmail({
        actor: actorLabel(rows[0]),
        title: delivery.title,
        fileNames: (files ?? []).map((f) => f.original_filename),
        folderName: folder?.name ?? null,
        filesUrl: adminUrl('/files'),
        settingsUrl: adminUrl('/settings'),
    });
    if (await sendEmail({ to: ownerEmail, ...email })) {
        await markNotified(rows.map((r) => r.id));
        return rows.length;
    }
    return 0;
}

/** Daily cron: notify about uploads whose recipient never signalled they were done. */
export async function notifyPendingUploads(): Promise<number> {
    const { data } = await createAdminClient()
        .from('activity')
        .select('delivery_id, recipient_id')
        .eq('type', 'uploaded')
        .is('notified_at', null)
        .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .limit(500);
    const groups = new Map<string, { deliveryId: string; recipientId: string | null }>();
    for (const row of data ?? []) {
        if (!row.delivery_id) continue;
        groups.set(`${row.delivery_id}:${row.recipient_id}`, { deliveryId: row.delivery_id, recipientId: row.recipient_id });
    }
    let sent = 0;
    for (const group of groups.values()) {
        sent += await notifyUploads(group.deliveryId, group.recipientId, { olderThanMs: 15 * 60 * 1000 });
    }
    return sent;
}
