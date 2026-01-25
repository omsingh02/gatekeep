import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateShortCode } from '@/lib/utils/shortCode';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { validateFileMetadata } from '@/lib/utils/fileTypes';
import { sanitizeFilename } from '@/lib/utils/sanitization';

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
    try {
        // Rate limiting: 10 uploads per 5 minutes per IP
        const identifier = getClientIdentifier(request);
        const { success } = rateLimit(identifier, 10, 5 * 60 * 1000);

        if (!success) {
            return NextResponse.json(
                { error: 'Upload limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        // Verify admin authentication
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { filename, fileSize, mimeType } = body;

        if (!filename || !fileSize || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: filename, fileSize, mimeType' },
                { status: 400 }
            );
        }

        // Validate file metadata (size, type, extension) without needing the actual file
        const validation = validateFileMetadata(filename, fileSize, mimeType);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Sanitize the original filename
        const sanitizedFilename = sanitizeFilename(filename);

        // Generate unique storage path and short code
        const fileExt = filename.split('.').pop()?.toLowerCase();
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const shortCode = generateShortCode();

        // Create presigned upload URL using admin client
        const adminClient = createAdminClient();
        const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
            .from('files')
            .createSignedUploadUrl(uniqueFilename);

        if (signedUrlError || !signedUrlData) {
            console.error('Failed to create signed upload URL:', signedUrlError);
            return NextResponse.json(
                { error: 'Failed to create upload URL' },
                { status: 500 }
            );
        }

        // Generate a unique file key to track this upload
        const fileKey = `${timestamp}-${Math.random().toString(36).substring(7)}`;

        // Return the signed URL and metadata needed for confirm step
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
            },
        });
    } catch (error) {
        console.error('Presign error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
