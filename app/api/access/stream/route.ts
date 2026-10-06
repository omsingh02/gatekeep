import { NextRequest } from 'next/server';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeShortCode, sanitizeUserIdentifier } from '@/lib/utils/sanitization';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get('shortCode');
    const userIdentifier = searchParams.get('userIdentifier');

    if (!shortCode || !userIdentifier) {
        return new Response('Missing parameters', { status: 400 });
    }

    // Sanitize inputs
    const sanitizedShortCode = sanitizeShortCode(shortCode);
    const sanitizedUserIdentifier = sanitizeUserIdentifier(userIdentifier);

    if (!sanitizedShortCode || !sanitizedUserIdentifier) {
        return new Response('Invalid parameters', { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const adminClient = createAdminClient();
            let heartbeat: NodeJS.Timeout | null = null;
            let checkInterval: NodeJS.Timeout | null = null;
            let channel: RealtimeChannel | null = null;

            try {
                // Get file and access info (exclude soft-deleted files)
                const { data: file } = await adminClient
                    .from('files')
                    .select('id')
                    .eq('short_code', sanitizedShortCode)
                    .is('deleted_at', null)
                    .single();

                if (!file) {
                    controller.close();
                    return;
                }

                // Get the specific access record to monitor
                const { data: accessRecord } = await adminClient
                    .from('file_access')
                    .select('id')
                    .eq('file_id', file.id)
                    .eq('user_identifier', sanitizedUserIdentifier)
                    .single();

                if (!accessRecord) {
                    controller.close();
                    return;
                }

                // Helper function to cleanup and close
                const cleanup = () => {
                    if (heartbeat) clearInterval(heartbeat);
                    if (checkInterval) clearInterval(checkInterval);
                    if (channel) channel.unsubscribe();
                };

                // Subscribe to DELETE events for this access record (manual revocation)
                channel = adminClient
                    .channel(`access_${shortCode}_${userIdentifier}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'DELETE',
                            schema: 'public',
                            table: 'file_access',
                            filter: `id=eq.${accessRecord.id}`,
                        },
                        () => {
                            // Access was deleted - revoke immediately
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ revoked: true })}\n\n`)
                            );
                            cleanup();
                            controller.close();
                        }
                )
                .subscribe();

                // Periodically check if access was deleted (fallback in case realtime fails)
                checkInterval = setInterval(async () => {
                    try {
                        const { data: currentAccess, error } = await adminClient
                            .from('file_access')
                            .select('id')
                            .eq('id', accessRecord.id)
                            .maybeSingle();

                        if (error || !currentAccess) {
                            // Access was deleted
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ revoked: true })}\n\n`)
                            );
                            cleanup();
                            controller.close();
                        }
                    } catch {
                        // Silently handle polling errors
                    }
                }, 30000); // Check every 30 seconds (less frequent since it's just a fallback)

                // Keep connection alive with heartbeat
                heartbeat = setInterval(() => {
                    controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                }, 30000); // 30 seconds

                // Cleanup on disconnect
                request.signal.addEventListener('abort', () => {
                    cleanup();
                    controller.close();
                });
            } catch {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
