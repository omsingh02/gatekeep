import { NextRequest, NextResponse } from 'next/server';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { requireRecipient, resolveDelivery } from '@/lib/deliveries/recipient-api';
import { evaluateSession } from '@/lib/deliveries/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/d/{code}/stream
 * Server-sent events for an open delivery page. Sends one `{ ended: true, reason, message }`
 * event when the recipient's access is removed, ends, or their session is replaced, then closes.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const resolved = await resolveDelivery(code);
    if ('response' in resolved) return resolved.response;
    const signedIn = await requireRecipient(request, resolved.delivery);
    if ('response' in signedIn) return signedIn.response;
    const { recipient, sender } = signedIn;
    const sessionHash = recipient.session_token_hash;

    const encoder = new TextEncoder();
    const admin = createAdminClient();

    const stream = new ReadableStream({
        start(controller) {
            let closed = false;
            let channel: RealtimeChannel | null = null;
            const timers: NodeJS.Timeout[] = [];

            const close = () => {
                if (closed) return;
                closed = true;
                timers.forEach(clearInterval);
                if (channel) void admin.removeChannel(channel);
                try {
                    controller.close();
                } catch {
                    // already closed by the client
                }
            };

            const check = (row: { removed_at: string | null; ends_at: string | null; session_expires_at: string | null; session_token_hash: string | null }) => {
                const status = row.session_token_hash !== sessionHash ? 'expired' : evaluateSession(row);
                if (status === 'ok') return;
                const message =
                    status === 'removed'
                        ? RECIPIENT_MESSAGES.removed(sender.name)
                        : status === 'ended'
                          ? RECIPIENT_MESSAGES.ended(sender.name)
                          : RECIPIENT_MESSAGES.sessionEnded;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ended: true, reason: status, message })}\n\n`));
                close();
            };

            channel = admin
                .channel(`gk_recipient_${recipient.id}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'delivery_recipients', filter: `id=eq.${recipient.id}` },
                    (payload) => check(payload.new as Parameters<typeof check>[0]),
                )
                .subscribe();

            // Fallback if realtime is unavailable, and to catch end dates passing
            timers.push(
                setInterval(async () => {
                    const { data } = await admin
                        .from('delivery_recipients')
                        .select('removed_at, ends_at, session_expires_at, session_token_hash')
                        .eq('id', recipient.id)
                        .maybeSingle();
                    if (data) check(data);
                    else close();
                }, 30_000),
            );
            timers.push(setInterval(() => !closed && controller.enqueue(encoder.encode(': heartbeat\n\n')), 25_000));
            request.signal.addEventListener('abort', close);
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}
