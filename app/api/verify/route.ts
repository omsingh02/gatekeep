import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/utils/crypto';
import { generateAccessToken, hashToken } from '@/lib/utils/tokens';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { sanitizeUserIdentifier, sanitizeShortCode } from '@/lib/utils/sanitization';
import { generateRequestId, logWarning } from '@/lib/utils/logger';
import type { Tables } from '@/lib/types';

type DenialReason = 'no_access_grant' | 'expired' | 'wrong_password' | 'download_limit' | 'invalid_session' | 'session_expired';

// Failed password/identifier guesses allowed per 15 minutes, counted from access_log so the
// limit holds across serverless instances (the in-memory limiter below is per instance)
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 20;
const MAX_FAILURES_PER_FILE = 100;
const GUESS_FAILURES: DenialReason[] = ['wrong_password', 'no_access_grant'];

function getClientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
           request.headers.get('x-real-ip') ||
           'unknown';
}

async function isPasswordGuessingThrottled(fileId: string, ip: string): Promise<boolean> {
    const adminClient = createAdminClient();
    const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
    const recentFailures = () => adminClient
        .from('access_log')
        .select('id', { count: 'exact', head: true })
        .eq('access_granted', false)
        .in('denial_reason', GUESS_FAILURES)
        .gte('accessed_at', since);

    const [byIp, byFile] = await Promise.all([
        recentFailures().eq('ip_address', ip),
        recentFailures().eq('file_id', fileId),
    ]);
    // On query errors the counts are null; fall back to the in-memory limiter rather than locking everyone out
    return (byIp.count ?? 0) >= MAX_FAILURES_PER_IP || (byFile.count ?? 0) >= MAX_FAILURES_PER_FILE;
}

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
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await adminClient.from('access_log').insert({
        file_id: fileId,
        user_identifier: userIdentifier,
        access_granted: granted,
        ip_address: ip,
        user_agent: userAgent,
        request_id: requestId,
        denial_reason: denialReason || null,
    });
}

export async function POST(request: NextRequest) {
    const requestId = generateRequestId();
    
    try {
        // Rate limiting: 5 attempts per minute per IP
        const identifier = getClientIdentifier(request);
        const { success } = rateLimit(identifier, 5, 60 * 1000);
        
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

        // Sanitize inputs to prevent injection attacks
        const sanitizedShortCode = sanitizeShortCode(shortCode);
        if (!sanitizedShortCode) {
            return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
        }

        // Try to get session token from cookie if not in body
        let cookieSessionToken = sessionToken;
        if (!cookieSessionToken) {
            cookieSessionToken = request.cookies.get(`access_${sanitizedShortCode}`)?.value;
        }

        if (!password && !cookieSessionToken) {
            return NextResponse.json({ error: 'Password or session token required' }, { status: 400 });
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
            // access_log.file_id references files(id), so unknown codes can't go in the audit table
            logWarning('/api/verify', 'file_not_found', 'Verification attempt for unknown short code', {
                requestId,
                shortCode: sanitizedShortCode,
            });
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Only password attempts are throttled; visitors with a valid session cookie are never locked out
        if (!cookieSessionToken && await isPasswordGuessingThrottled(file.id, getClientIp(request))) {
            logWarning('/api/verify', 'password-throttled', 'Too many failed password attempts', {
                requestId,
                fileId: file.id,
            });
            return NextResponse.json(
                { error: 'Too many failed attempts. Please try again in 15 minutes.' },
                { status: 429 }
            );
        }

        // Get access grant based on access type
        let access: Tables<'file_access'> | null = null;

        if (isPublic) {
            // Check for public access grant
            const { data: publicAccess } = await adminClient
                .from('file_access')
                .select('*')
                .eq('file_id', file.id)
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
                .eq('file_id', file.id)
                .eq('user_identifier', sanitizedUserIdentifier)
                .maybeSingle();

            if (userAccess) {
                access = userAccess;
            }
        }

        if (!access) {
            await logAccess(file.id, sanitizedUserIdentifier || 'public', false, request, requestId, 'no_access_grant');
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Check if expired
        if (access.expires_at && new Date(access.expires_at) < new Date()) {
            await logAccess(file.id, sanitizedUserIdentifier || 'public', false, request, requestId, 'expired');
            return NextResponse.json({ error: 'Access expired' }, { status: 403 });
        }

        // Check download limit
        const maxDownloads = access.max_downloads;
        const downloadCount = access.download_count || 0;
        if (maxDownloads !== null && downloadCount >= maxDownloads) {
            await logAccess(file.id, sanitizedUserIdentifier || 'public', false, request, requestId, 'download_limit');
            return NextResponse.json({ error: 'Download limit reached' }, { status: 403 });
        }

        let newSessionToken: string | null = null;

        // Verify either password or session token (from cookie or body)
        if (cookieSessionToken) {
            // Session token authentication (from cookie or request body)
            const tokenHash = await hashToken(cookieSessionToken);
            if (access.session_token !== tokenHash) {
                await logAccess(file.id, sanitizedUserIdentifier || 'public', false, request, requestId, 'invalid_session');
                return NextResponse.json({ error: 'Invalid session' }, { status: 403 });
            }

            // Check if session expired
            if (access.session_expires_at && new Date(access.session_expires_at) < new Date()) {
                await logAccess(file.id, sanitizedUserIdentifier || 'public', false, request, requestId, 'session_expired');
                return NextResponse.json({ error: 'Session expired' }, { status: 403 });
            }
        } else if (password) {
            // Password authentication - create new session
            const isValid = await verifyPassword(password, access.password_hash);
            if (!isValid) {
                await logAccess(file.id, sanitizedUserIdentifier || 'public', false, request, requestId, 'wrong_password');
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
                })
                .eq('id', access.id);
        }

        // Log successful access
        await logAccess(file.id, sanitizedUserIdentifier || 'public', true, request, requestId);

        // Update access_count (page views) and timestamp
        // download_count is now tracked separately in /api/access/download when user actually downloads
        await adminClient
            .from('file_access')
            .update({
                access_count: access.access_count + 1,
                last_accessed: new Date().toISOString(),
            })
            .eq('id', access.id);

        // Get signed URL for file with download option for proper Content-Disposition
        const { data: signedUrlData, error: urlError } = await adminClient.storage
            .from('files')
            .createSignedUrl(file.filename, 3600, {
                download: file.original_filename, // Supabase handles RFC 5987 encoding
            });

        if (urlError || !signedUrlData) {
            return NextResponse.json({ error: 'Failed to generate file URL' }, { status: 500 });
        }

        const response = NextResponse.json({
            success: true,
            fileUrl: signedUrlData.signedUrl,
            file: {
                id: file.id,
                originalFilename: file.original_filename,
                mimeType: file.mime_type,
                fileSize: file.file_size,
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
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
