import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { validateFileMetadata } from '@/lib/utils/fileTypes';
import { sanitizeFilename } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';
import { validateAuth, validateRequiredFields } from '@/lib/utils/validation';

/**
 * POST /api/files/presign
 * 
 * Generates a presigned upload URL for direct browser-to-Supabase uploads.
 * This bypasses Vercel's 4.5MB body limit by having the browser upload directly.
 * 
 * Request body: { filename: string, fileSize: number, mimeType: string }
 * Response: { uploadUrl: string, token: string, path: string, fileKey: string }
 */
export async function POST(request: NextRequest) {
    let userId: string | undefined;
    try {
        // Rate limiting: 100 uploads per 10 minutes per IP (allows folder uploads)
        const identifier = getClientIdentifier(request);
        const { success } = rateLimit(identifier, 100, 10 * 60 * 1000);

        if (!success) {
            logWarning('/api/files/presign', 'rate-limit', 'Upload rate limit exceeded', {
                identifier: identifier.substring(0, 15),
            });
            return NextResponse.json(
                { error: 'Upload limit exceeded. Please try again later.', code: 'ERR_RATE_LIMIT' },
                { status: 429 }
            );
        }

        // Verify admin authentication
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/files/presign', 'POST');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        // Parse request body
        const body = await request.json();
        const { filename, fileSize, mimeType } = body;

        // Validate required fields
        const requiredError = validateRequiredFields(body, ['filename', 'fileSize', 'mimeType'], '/api/files/presign');
        if (requiredError) return requiredError;

        // Validate file metadata (size, type, extension) without needing the actual file
        const validation = validateFileMetadata(filename, fileSize, mimeType);
        if (!validation.valid) {
            logWarning('/api/files/presign', 'file-validation', validation.error, {
                filenameSample: filename.substring(0, 20),
                fileSize,
                mimeTypeSample: mimeType.substring(0, 30),
            });
            return NextResponse.json(
                { error: validation.error, code: 'ERR_INVALID_FILE' },
                { status: 400 }
            );
        }

        // Sanitize the original filename
        const sanitizedFilename = sanitizeFilename(filename);

        // Unique storage path. Files have no link of their own: they're shared through deliveries.
        const fileExt = filename.split('.').pop()?.toLowerCase();
        const timestamp = Date.now();
        const uniqueFilename = fileExt
            ? `${timestamp}-${randomUUID()}.${fileExt}`
            : `${timestamp}-${randomUUID()}`;

        const adminClient = createAdminClient();

        // Optional target folder: it must be one of this owner's folders
        const folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : null;
        if (folderId) {
            const { data: folder } = await adminClient
                .from('folders')
                .select('id')
                .eq('id', folderId)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .maybeSingle();
            if (!folder) {
                return NextResponse.json(
                    { error: "That folder doesn't exist any more. Pick another folder and try again.", code: 'ERR_FOLDER_NOT_FOUND' },
                    { status: 404 }
                );
            }
        }

        // Create presigned upload URL using admin client
        const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
            .from('files')
            .createSignedUploadUrl(uniqueFilename);

        if (signedUrlError || !signedUrlData) {
            logError('/api/files/presign', user.id, 'create-signed-url', signedUrlError, {
                filenameSample: filename.substring(0, 20),
            });
            return NextResponse.json(
                { error: 'Failed to create upload URL', code: 'ERR_STORAGE' },
                { status: 500 }
            );
        }

        // Generate a unique file key to track this upload
        const fileKey = randomUUID();

        // Return these so the client can send them in the confirm request
        return NextResponse.json({
            uploadUrl: signedUrlData.signedUrl,
            token: signedUrlData.token,
            path: signedUrlData.path,
            fileKey,
            // Return these so the client can send them in the confirm request
            metadata: {
                uniqueFilename,
                sanitizedFilename,
                fileSize,
                mimeType,
                userId: user.id,
                folderId,
            },
        });
    } catch (error) {
        logError('/api/files/presign', userId, 'presign-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_PRESIGN' }, { status: 500 });
    }
}
