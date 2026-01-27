import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateShortCode } from '@/lib/utils/shortCode';
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
    let user: any;
    try {
        // Rate limiting: 10 uploads per 5 minutes per IP
        const identifier = getClientIdentifier(request);
        const { success } = rateLimit(identifier, 10, 5 * 60 * 1000);

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
        user = validateAuth(userData, '/api/files/presign', 'POST');
        if (user instanceof NextResponse) return user;

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

        // Generate unique storage path and short code
        const fileExt = filename.split('.').pop()?.toLowerCase();
        const timestamp = Date.now();
        const uniqueFilename = fileExt
            ? `${timestamp}-${randomUUID()}.${fileExt}`
            : `${timestamp}-${randomUUID()}`;
        const shortCode = generateShortCode();

        // Create presigned upload URL using admin client
        const adminClient = createAdminClient();
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

        // Get optional folderId from request
        const { folderId } = body;

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
                shortCode,
                fileSize,
                mimeType,
                userId: user.id,
                folderId: folderId || null,
            },
        });
    } catch (error) {
        const userId = user?.id;
        logError('/api/files/presign', userId, 'presign-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_PRESIGN' }, { status: 500 });
    }
}
