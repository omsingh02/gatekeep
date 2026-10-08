import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFileExtension } from '@/lib/utils/fileTypes';
import { rateLimit } from '@/lib/utils/ratelimit';
import { clientInfo } from '@/lib/deliveries/activity';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { readJson, serverError } from '@/lib/deliveries/http';
import { requireRecipient, resolveDelivery } from '@/lib/deliveries/recipient-api';
import { uploadProblem } from '@/lib/deliveries/uploads';

/**
 * POST /api/d/{code}/uploads  { filename, size, mimeType }
 * Starts an upload to a request: returns a signed upload URL for the browser to send the file to
 * directly. Call /uploads/confirm afterwards.
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

        if (!rateLimit(`upload:${clientInfo(request).ip}`, 120, 10 * 60 * 1000).success) {
            return NextResponse.json({ error: RECIPIENT_MESSAGES.throttled, code: 'ERR_RATE_LIMIT' }, { status: 429 });
        }

        const body = await readJson(request);
        const problem = await uploadProblem(delivery, recipient, { filename: body.filename, size: body.size, mimeType: body.mimeType });
        if (problem) return NextResponse.json({ error: problem, code: 'ERR_INVALID_FILE' }, { status: 400 });

        const extension = getFileExtension(body.filename as string);
        const path = `${Date.now()}-${randomUUID()}${extension ? `.${extension}` : ''}`;
        const { data, error } = await createAdminClient().storage.from('files').createSignedUploadUrl(path);
        if (error || !data) {
            return NextResponse.json({ error: "We couldn't start the upload. Try again in a moment.", code: 'ERR_STORAGE' }, { status: 502 });
        }

        return NextResponse.json({ uploadUrl: data.signedUrl, token: data.token, path: data.path });
    } catch (err) {
        return serverError('/api/d/[code]/uploads', undefined, 'POST', err);
    }
}
