import { NextRequest, NextResponse } from 'next/server';
import { runAfterResponse } from '@/lib/deliveries/activity';
import { serverError } from '@/lib/deliveries/http';
import { notifyUploads } from '@/lib/deliveries/notifications';
import { requireRecipient, resolveDelivery } from '@/lib/deliveries/recipient-api';

/**
 * POST /api/d/{code}/uploads/complete
 * The recipient finished a batch of uploads: send the owner one email about them.
 * (If this is never called, the daily job sends it.)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const resolved = await resolveDelivery(code);
        if ('response' in resolved) return resolved.response;
        const signedIn = await requireRecipient(request, resolved.delivery);
        if ('response' in signedIn) return signedIn.response;

        const deliveryId = resolved.delivery.id;
        const recipientId = signedIn.recipient.id;
        runAfterResponse(async () => {
            await notifyUploads(deliveryId, recipientId);
        });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return serverError('/api/d/[code]/uploads/complete', undefined, 'POST', err);
    }
}
