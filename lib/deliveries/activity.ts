import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/utils/logger';
import type { ActivityReason, ActivityType, Tables } from '@/lib/types';

export function clientInfo(request: Request): { ip: string; userAgent: string } {
    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
    return { ip, userAgent: request.headers.get('user-agent') || 'unknown' };
}

export interface ActivityInput {
    ownerId: string;
    type: ActivityType;
    deliveryId?: string | null;
    recipientId?: string | null;
    fileId?: string | null;
    reason?: ActivityReason | null;
    /** Shown in the feed: the recipient's email or username; null for "Anyone with the password" */
    actor?: string | null;
    request?: Request;
    requestId?: string;
    /** Send owner notifications for this event (per their settings). Default true. */
    notify?: boolean;
}

/**
 * Record one event. Never throws: losing an activity row must not break the recipient's request.
 * Notifications are sent after the response (Next.js `after`), so they don't slow it down.
 */
export async function recordActivity(input: ActivityInput): Promise<Tables<'activity'> | null> {
    const info = input.request ? clientInfo(input.request) : { ip: null, userAgent: null };
    const { data, error } = await createAdminClient()
        .from('activity')
        .insert({
            owner_id: input.ownerId,
            type: input.type,
            delivery_id: input.deliveryId ?? null,
            recipient_id: input.recipientId ?? null,
            file_id: input.fileId ?? null,
            reason: input.reason ?? null,
            actor: input.actor ?? null,
            ip: info.ip,
            user_agent: info.userAgent ? info.userAgent.slice(0, 300) : null,
            request_id: input.requestId ?? null,
        })
        .select('*')
        .single();
    if (error || !data) {
        logError('activity', input.ownerId, 'record', error, { type: input.type });
        return null;
    }

    if (input.notify !== false && ['opened', 'downloaded', 'downloaded_all', 'denied'].includes(data.type)) {
        runAfterResponse(async () => {
            const { dispatchNotification } = await import('./notifications');
            await dispatchNotification(data);
        });
    }
    return data;
}

/** Run work after the response is sent when inside a request; otherwise run it now. */
export function runAfterResponse(task: () => Promise<void>): void {
    const safe = async () => {
        try {
            await task();
        } catch (err) {
            logError('after-response', undefined, 'task', err);
        }
    };
    try {
        after(safe);
    } catch {
        void safe();
    }
}

/** Failed password/code guesses allowed per 15 minutes, counted in the database so the limit holds across instances. */
export const MAX_FAILURES_PER_IP = 20;
export const MAX_FAILURES_PER_DELIVERY = 100;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const GUESS_REASONS: ActivityReason[] = ['wrong_password', 'wrong_code', 'not_on_delivery'];

export async function guessingThrottled(deliveryId: string, ip: string): Promise<boolean> {
    const admin = createAdminClient();
    const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
    const recent = () =>
        admin
            .from('activity')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'denied')
            .in('reason', GUESS_REASONS)
            .gte('created_at', since);
    const [byIp, byDelivery] = await Promise.all([recent().eq('ip', ip), recent().eq('delivery_id', deliveryId)]);
    return (byIp.count ?? 0) >= MAX_FAILURES_PER_IP || (byDelivery.count ?? 0) >= MAX_FAILURES_PER_DELIVERY;
}

/** Code requests allowed per IP per 10 minutes (known or unknown emails alike). */
export const MAX_CODE_REQUESTS_PER_IP = 10;

export async function codeRequestsThrottled(ip: string): Promise<boolean> {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await createAdminClient()
        .from('activity')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .in('type', ['code_sent', 'denied'])
        .gte('created_at', since)
        .or('type.eq.code_sent,reason.eq.not_on_delivery');
    return (count ?? 0) >= MAX_CODE_REQUESTS_PER_IP;
}
