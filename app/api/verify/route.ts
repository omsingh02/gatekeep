import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/utils/crypto';
import { generateAccessToken, hashToken } from '@/lib/utils/tokens';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { sanitizeUserIdentifier, sanitizeShortCode } from '@/lib/utils/sanitization';
import { generateRequestId, logInfo } from '@/lib/utils/logger';

type DenialReason = 'file_not_found' | 'no_access_grant' | 'expired' | 'wrong_password' | 'download_limit' | 'invalid_session' | 'session_expired';

// Helper to log access attempts
async function logAccess(
    fileId: string,
    userIdentifier: string,
    granted: boolean,
    request: NextRequest,
    requestId: string,
    denialReason?: DenialReason
) {
    const adminClient = createAdminClient();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await adminClient.from('access_log').insert({
        file_id: fileId,
        user_identifier: userIdentifier,
        access_granted: granted,
        ip_address: ip,
        user_agent: userAgent,
        request_id: requestId,
        denial_reason: denialReason || null,
    } as any);
}

export async function POST(request: NextRequest) {
    const requestId = generateRequestId();
    
    try {
        // Rate limiting: 5 attempts per minute per IP
        const identifier = getClientIdentifier(request);
        const { success, remaining } = rateLimit(identifier, 5, 60 * 1000);
        
        if (!success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again later.' },
                { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
            );
        }

        const body = await request.json();
        const { shortCode, userIdentifier, password, sessionToken, isPublic } = body;

        // For public access: require shortCode and (password or sessionToken)
        // For user access: require shortCode, userIdentifier, and (password or sessionToken)
        if (!shortCode) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!isPublic && !userIdentifier) {
            return NextResponse.json({ error: 'User identifier required' }, { status: 400 });
        }

        // Try to get session token from cookie if not in body
        let cookieSessionToken = sessionToken;
        if (!cookieSessionToken) {
            cookieSessionToken = request.cookies.get(`access_${sanitizedShortCode}`)?.value;
        }

        if (!password && !cookieSessionToken) {
            return NextResponse.json({ error: 'Password or session token required' }, { status: 400 });
        }

        // Sanitize inputs to prevent injection attacks
        const sanitizedShortCode = sanitizeShortCode(shortCode);
        if (!sanitizedShortCode) {
            return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
        }

        let sanitizedUserIdentifier: string | null = null;
        if (userIdentifier) {
            sanitizedUserIdentifier = sanitizeUserIdentifier(userIdentifier);
            if (!sanitizedUserIdentifier) {
                return NextResponse.json({ error: 'Invalid user identifier' }, { status: 400 });
            }
        }

        const adminClient = createAdminClient();

        // Get file by short code (exclude soft-deleted files)
        const { data: file, error: fileError } = await adminClient
            .from('files')
            .select('*')
            .eq('short_code', sanitizedShortCode)
            .is('deleted_at', null)
            .single();

        if (fileError || !file) {
            // Log failed attempt (file not found)
            await logAccess('00000000-0000-0000-0000-000000000000', sanitizedUserIdentifier || 'public', false, request, requestId, 'file_not_found');
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Get access grant based on access type
        let access: any = null;

        if (isPublic) {
            // Check for public access grant
            const { data: publicAccess } = await adminClient
                .from('file_access')
                .select('*')
                .eq('file_id', (file as any).id)
                .eq('is_public', true)
                .maybeSingle();

            if (publicAccess) {
                access = publicAccess;
            }
        } else if (sanitizedUserIdentifier) {
            // Check for user-specific access
            const { data: userAccess } = await adminClient
                .from('file_access')
                .select('*')
                .eq('file_id', (file as any).id)
                .eq('user_identifier', sanitizedUserIdentifier)
                .maybeSingle();

            if (userAccess) {
                access = userAccess;
            } else {
                // Check for group-based access
                const { data: groupAccess } = await adminClient
                    .from('file_access')
                    .select('*, groups:group_id(name), group_members!inner(member_identifier)')
                    .eq('file_id', (file as any).id)
                    .eq('group_members.member_identifier', sanitizedUserIdentifier)
                    .maybeSingle();

                if (groupAccess) {
                    access = groupAccess;
                }
            }
        }

        if (!access) {
            await logAccess((file as any).id, sanitizedUserIdentifier || 'public', false, request, requestId, 'no_access_grant');
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Check if expired
        if ((access as any).expires_at && new Date((access as any).expires_at) < new Date()) {
            await logAccess((file as any).id, sanitizedUserIdentifier || 'public', false, request, requestId, 'expired');
            return NextResponse.json({ error: 'Access expired' }, { status: 403 });
        }

        // Check download limit
        const maxDownloads = (access as any).max_downloads;
        const downloadCount = (access as any).download_count || 0;
        if (maxDownloads !== null && downloadCount >= maxDownloads) {
            await logAccess((file as any).id, sanitizedUserIdentifier || 'public', false, request, requestId, 'download_limit');
            return NextResponse.json({ error: 'Download limit reached' }, { status: 403 });
        }

        let newSessionToken: string | null = null;

        // Verify either password or session token (from cookie or body)
        if (cookieSessionToken) {
            // Session token authentication (from cookie or request body)
            const tokenHash = await hashToken(cookieSessionToken);
            if ((access as any).session_token !== tokenHash) {
                await logAccess((file as any).id, sanitizedUserIdentifier || 'public', false, request, requestId, 'invalid_session');
                return NextResponse.json({ error: 'Invalid session' }, { status: 403 });
            }

            // Check if session expired
            if ((access as any).session_expires_at && new Date((access as any).session_expires_at) < new Date()) {
                await logAccess((file as any).id, sanitizedUserIdentifier || 'public', false, request, requestId, 'session_expired');
                return NextResponse.json({ error: 'Session expired' }, { status: 403 });
            }
        } else if (password) {
            // Password authentication - create new session
            const isValid = await verifyPassword(password, (access as any).password_hash);
            if (!isValid) {
                await logAccess((file as any).id, sanitizedUserIdentifier || 'public', false, request, requestId, 'wrong_password');
                return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
            }

            // Generate new session token (24 hour expiry)
            newSessionToken = generateAccessToken();
            const tokenHash = await hashToken(newSessionToken);
            const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            // Store hashed token (don't increment counts yet - do it once below)
            await adminClient
                .from('file_access')
                .update({
                    session_token: tokenHash,
                    session_expires_at: sessionExpiresAt,
                } as never)
                .eq('id', (access as any).id);
        }

        // Log successful access
        await logAccess((file as any).id, sanitizedUserIdentifier || 'public', true, request, requestId);

        // Update access_count (page views) and timestamp
        // download_count is now tracked separately in /api/access/download when user actually downloads
        await adminClient
            .from('file_access')
            .update({
                access_count: (access as any).access_count + 1,
                last_accessed: new Date().toISOString(),
            } as never)
            .eq('id', (access as any).id);

        // Get signed URL for file with download option for proper Content-Disposition
        const { data: signedUrlData, error: urlError } = await adminClient.storage
            .from('files')
            .createSignedUrl((file as any).filename, 3600, {
                download: (file as any).original_filename, // Supabase handles RFC 5987 encoding
            });

        if (urlError || !signedUrlData) {
            return NextResponse.json({ error: 'Failed to generate file URL' }, { status: 500 });
        }

        const response = NextResponse.json({
            success: true,
            fileUrl: signedUrlData.signedUrl,
            file: {
                id: (file as any).id,
                originalFilename: (file as any).original_filename,
                mimeType: (file as any).mime_type,
                fileSize: (file as any).file_size,
            },
        });

        // Set httpOnly cookie for session token (only on password auth)
        // Cookie is automatically sent with subsequent requests and cannot be accessed by XSS
        if (newSessionToken) {
            response.cookies.set({
                name: `access_${sanitizedShortCode}`,
                value: newSessionToken,
                httpOnly: true, // Prevents JavaScript access (XSS protection)
                secure: process.env.NODE_ENV === 'production', // HTTPS only in production
                sameSite: 'strict', // CSRF protection
                maxAge: 24 * 60 * 60, // 24 hours in seconds
                path: '/',
            });
        }

        return response;
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
