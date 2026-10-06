import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashToken } from '@/lib/utils/tokens';
import { sanitizeUserIdentifier, sanitizeShortCode } from '@/lib/utils/sanitization';

/**
 * POST /api/access/download
 * Track actual file downloads and return a fresh signed URL
 * 
 * This endpoint is called when the user clicks "Download" or "Preview" button.
 * It validates the session token and increments the download_count.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { shortCode, userIdentifier, action = 'download' } = body;

        // Validate required fields (userIdentifier can be empty for public access)
        if (!shortCode) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Sanitize short code early and use sanitized value for cookie lookup to avoid mismatches
        const sanitizedShortCode = sanitizeShortCode(shortCode);
        if (!sanitizedShortCode) {
            return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
        }

        // Get session token from httpOnly cookie (use sanitized short code)
        const sessionToken = request.cookies.get(`access_${sanitizedShortCode}`)?.value;
        if (!sessionToken) {
            return NextResponse.json({ error: 'Session token required' }, { status: 401 });
        }

        // Sanitize user identifier
        const sanitizedUserIdentifier = userIdentifier ? sanitizeUserIdentifier(userIdentifier) : null;

        const adminClient = createAdminClient();

        // Get file by short code (exclude soft-deleted files)
        const { data: file, error: fileError } = await adminClient
            .from('files')
            .select('id, filename, original_filename, mime_type')
            .eq('short_code', sanitizedShortCode)
            .is('deleted_at', null)
            .single();

        if (fileError || !file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Get access grant and validate session token
        const tokenHash = await hashToken(sessionToken);
        let accessQuery = adminClient
            .from('file_access')
            .select('id, download_count, max_downloads, expires_at, session_expires_at')
            .eq('file_id', file.id)
            .eq('session_token', tokenHash);

        // Public access has no userIdentifier; otherwise match the user-specific grant
        accessQuery = sanitizedUserIdentifier
            ? accessQuery.eq('user_identifier', sanitizedUserIdentifier)
            : accessQuery.eq('is_public', true);

        const { data: access } = await accessQuery.maybeSingle();

        if (!access) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 403 });
        }

        // Check if access expired
        if (access.expires_at && new Date(access.expires_at) < new Date()) {
            return NextResponse.json({ error: 'Access expired' }, { status: 403 });
        }

        // Check if session expired
        if (access.session_expires_at && new Date(access.session_expires_at) < new Date()) {
            return NextResponse.json({ error: 'Session expired' }, { status: 403 });
        }

        // Check download limit
        const maxDownloads = access.max_downloads;
        const downloadCount = access.download_count || 0;
        if (maxDownloads !== null && downloadCount >= maxDownloads) {
            return NextResponse.json({ error: 'Download limit reached' }, { status: 403 });
        }

        // Increment download_count for both downloads and previews
        // This tracks every time the file content is actually fetched
        await adminClient
            .from('file_access')
            .update({
                download_count: downloadCount + 1,
                last_accessed: new Date().toISOString(),
            })
            .eq('id', access.id);

        // Generate a short-lived signed URL (60 seconds for security)
        const { data: signedUrlData, error: urlError } = await adminClient.storage
            .from('files')
            .createSignedUrl(file.filename, 60, {
                download: action === 'download' ? file.original_filename : undefined,
            });

        if (urlError || !signedUrlData) {
            return NextResponse.json({ error: 'Failed to generate file URL' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            fileUrl: signedUrlData.signedUrl,
            file: {
                originalFilename: file.original_filename,
                mimeType: file.mime_type,
            },
            downloadCount: downloadCount + 1,
            maxDownloads: maxDownloads,
        });
    } catch (error) {
        console.error('Download tracking error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
