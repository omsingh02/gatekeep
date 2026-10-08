import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPassword } from '@/lib/utils/crypto';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { sanitizeUserIdentifier } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';
import { validateAuth, validateAndSanitize } from '@/lib/utils/validation';
import { sendAccessGrantEmail } from '@/lib/email';
import type { Database, Tables } from '@/lib/types';

type FileAccessUpdate = Database['public']['Tables']['file_access']['Update'];

/** Returns a message describing the first invalid setting, or null when they're all valid. */
function validateAccessSettings({ password, expiresAt, maxDownloads }: { password?: unknown; expiresAt?: unknown; maxDownloads?: unknown }): string | null {
    if (password) {
        if (typeof password !== 'string' || password.length < 8) return 'Use a password of at least 8 characters.';
    }
    if (expiresAt) {
        const endsAt = new Date(String(expiresAt)).getTime();
        if (Number.isNaN(endsAt)) return "That end date isn't valid.";
        if (endsAt <= Date.now()) return 'Pick an end date in the future.';
    }
    // 0, '' and null all mean "no limit"
    if (maxDownloads) {
        const limit = Number(maxDownloads);
        if (!Number.isInteger(limit) || limit < 1) return 'The download limit must be a whole number of at least 1.';
    }
    return null;
}

// API shape for a grant. Never expose password_hash or session_token.
function serializeAccess(a: Tables<'file_access'>) {
    return {
        id: a.id,
        fileId: a.file_id,
        type: a.is_public ? 'public' : 'user',
        userIdentifier: a.user_identifier || undefined,
        isPublic: a.is_public,
        expiresAt: a.expires_at,
        accessCount: a.access_count,
        downloadCount: a.download_count,
        maxDownloads: a.max_downloads,
        lastAccessed: a.last_accessed,
        createdAt: a.created_at,
    };
}

export async function GET(request: NextRequest) {
    let userId: string | undefined;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/access', 'GET');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get('fileId');
        const limit = searchParams.get('limit');
        const page = searchParams.get('page');
        const search = searchParams.get('search');
        const status = searchParams.get('status'); // active, expired, limit_reached
        const limitNum = Math.min(Math.max(parseInt(limit || '', 10) || 20, 1), 100); // Bounded 1-100, default 20
        const pageNum = Math.max(parseInt(page || '', 10) || 1, 1); // Minimum 1

        const adminClient = createAdminClient();

        // If fileId is provided, get access for that specific file
        if (fileId) {
            // Verify file ownership (exclude soft-deleted files)
            const { data: file, error: fileError } = await adminClient
                .from('files')
                .select('*')
                .eq('id', fileId)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .single();

            if (fileError || !file) {
                logWarning('/api/access', 'file-access', 'File not found or unauthorized', {
                    fileId: fileId.substring(0, 8),
                    userId: user.id.substring(0, 8),
                });
                return NextResponse.json({ error: 'File not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
            }

            // Get access list for this file
            const { data: access, error: accessError } = await adminClient
                .from('file_access')
                .select('*')
                .eq('file_id', fileId)
                .order('created_at', { ascending: false });

            if (accessError) {
                logError('/api/access', user.id, 'fetch-access-list', accessError, {
                    fileId: fileId.substring(0, 8),
                });
                return NextResponse.json({ error: 'Failed to fetch access list', code: 'ERR_DB_ERROR' }, { status: 500 });
            }

            // Transform to camelCase
            const transformedAccess = (access || []).map(serializeAccess);

            return NextResponse.json({ access: transformedAccess });
        }

        // Calculate offset for pagination
        const offset = (pageNum - 1) * limitNum;

        // Get all shares for the user (across all their files) with count in single query
        let query = adminClient
            .from('file_access')
            .select('*, files!inner(id, original_filename, short_code, uploaded_by)', { count: 'exact' })
            .eq('files.uploaded_by', user.id)
            .order('created_at', { ascending: false });

        // Search filter - search by user identifier or filename
        if (search && search.trim()) {
            const sanitized = search.trim().slice(0, 100);
            query = query.or(`user_identifier.ilike.%${sanitized}%,files.original_filename.ilike.%${sanitized}%`);
        }

        // Apply pagination
        query = query.range(offset, offset + limitNum - 1);

        const { data: access, count: totalCount, error: accessError } = await query;

        if (accessError) {
            logError('/api/access', user.id, 'fetch-all-access', accessError);
            return NextResponse.json({ error: 'Failed to fetch access list', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Transform to camelCase with file info
        const now = new Date();
        let transformedAccess = (access || []).map((a) => {
            const expiresAt = a.expires_at ? new Date(a.expires_at) : null;
            const isExpired = expiresAt ? expiresAt < now : false;
            const isLimitReached = a.max_downloads ? (a.download_count || 0) >= a.max_downloads : false;

            return {
                ...serializeAccess(a),
                file: {
                    id: a.files.id,
                    originalFilename: a.files.original_filename,
                    shortCode: a.files.short_code,
                },
                status: isExpired ? 'expired' : isLimitReached ? 'limit_reached' : 'active',
            };
        });

        // Filter by status (done after fetch since we need computed status)
        if (status && status !== 'all') {
            transformedAccess = transformedAccess.filter(a => a.status === status);
        }

        // Calculate pagination metadata
        const totalPages = Math.ceil((totalCount || 0) / limitNum);

        return NextResponse.json({ 
            access: transformedAccess, 
            totalCount: totalCount || 0,
            page: pageNum,
            limit: limitNum,
            totalPages,
        });
    } catch (error) {
        logError('/api/access', userId, 'GET-access-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_ACCESS_GET' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let userId: string | undefined;
    try {
        // Rate limiting: 20 access grants per minute per IP
        const identifier = getClientIdentifier(request);
        const { success } = rateLimit(identifier, 20, 60 * 1000);
        
        if (!success) {
            logWarning('/api/access', 'rate-limit', 'Access grant rate limit exceeded', {
                identifier: identifier.substring(0, 15),
            });
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.', code: 'ERR_RATE_LIMIT' },
                { status: 429 }
            );
        }

        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/access', 'POST');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const body = await request.json();
        const { fileId, userIdentifier, password, expiresAt, maxDownloads, identifierType, notifyOnGrant, isPublic } = body;

        // Validate identifier type
        const validIdentifierType = identifierType === 'email' ? 'email' : 'username';
        const shouldNotify = validIdentifierType === 'email' && notifyOnGrant === true && !isPublic;

        // Validate required fields based on access type
        if (!fileId || !password) {
            logWarning('/api/access', 'validation-failed', 'Missing required fields', { fileId: fileId || 'none' });
            return NextResponse.json({ error: 'fileId and password are required', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        // For non-public shares, require userIdentifier
        if (!isPublic && !userIdentifier) {
            logWarning('/api/access', 'validation-failed', 'Missing user identifier for non-public share', { fileId: fileId || 'none' });
            return NextResponse.json({ error: 'User identifier is required for non-public shares', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        if (isPublic && userIdentifier) {
            return NextResponse.json({ error: 'Public shares cannot have a user identifier', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const invalidSetting = validateAccessSettings({ password, expiresAt, maxDownloads });
        if (invalidSetting) {
            return NextResponse.json({ error: invalidSetting, code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        let sanitizedUserIdentifier: string | null = null;
        if (userIdentifier) {
            const sanitized = validateAndSanitize(userIdentifier, sanitizeUserIdentifier, '/api/access', 'user identifier');
            if (sanitized instanceof NextResponse) return sanitized;
            sanitizedUserIdentifier = sanitized;
        }

        // Verify file ownership (exclude soft-deleted files)
        const adminClient = createAdminClient();
        const { data: file, error: fileError } = await adminClient
            .from('files')
            .select('*')
            .eq('id', fileId)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .single();

        if (fileError || !file) {
            logWarning('/api/access', 'file-access', 'File not found or unauthorized', {
                fileId: fileId.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'File not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        // Check if access grant already exists for this user/file combo
        if (sanitizedUserIdentifier) {
            const { data: existingAccess } = await adminClient
                .from('file_access')
                .select('id')
                .eq('file_id', fileId)
                .eq('user_identifier', sanitizedUserIdentifier)
                .maybeSingle();

            if (existingAccess) {
                logWarning('/api/access', 'duplicate-access', 'User already has access to this file', {
                    fileId: fileId.substring(0, 8),
                    userIdentifier: sanitizedUserIdentifier.substring(0, 10),
                });
                return NextResponse.json(
                    { error: 'User already has access to this file. Use edit to modify the existing grant.', code: 'ERR_CONFLICT' },
                    { status: 409 }
                );
            }
        }

        // Check for existing public share on this file
        if (isPublic) {
            const { data: existingPublic } = await adminClient
                .from('file_access')
                .select('id')
                .eq('file_id', fileId)
                .eq('is_public', true)
                .maybeSingle();

            if (existingPublic) {
                return NextResponse.json(
                    { error: 'A public share already exists for this file. Edit the existing grant instead.', code: 'ERR_CONFLICT' },
                    { status: 409 }
                );
            }
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create new access grant
        const { data: access, error: accessError } = await adminClient
            .from('file_access')
            .insert({
                file_id: fileId,
                user_identifier: sanitizedUserIdentifier,
                password_hash: passwordHash,
                expires_at: expiresAt || null,
                max_downloads: maxDownloads || null,
                identifier_type: isPublic ? null : validIdentifierType,
                notify_on_grant: shouldNotify,
                is_public: isPublic || false,
            })
            .select()
            .single();

        if (accessError || !access) {
            logError('/api/access', user.id, 'create-access-grant', accessError, {
                fileId: fileId.substring(0, 8),
                userIdentifier: sanitizedUserIdentifier?.substring(0, 10),
            });
            return NextResponse.json({ error: 'Failed to create access grant', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Send email notification if requested (fire and forget - don't block on email)
        let emailSent = false;
        if (shouldNotify && sanitizedUserIdentifier) {
            try {
                emailSent = await sendAccessGrantEmail({
                    to: sanitizedUserIdentifier,
                    fileName: file.original_filename,
                    shortCode: file.short_code,
                    password: password, // Original password before hashing
                    expiresAt: expiresAt || null,
                    maxDownloads: maxDownloads || null,
                });
            } catch (emailError) {
                // Log but don't fail the request
                console.error('[Email] Failed to send notification:', emailError);
            }
        }

        return NextResponse.json({
            success: true,
            emailSent,
            access: serializeAccess(access),
        });
    } catch (error) {
        logError('/api/access', userId, 'POST-access-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_ACCESS_POST' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    let userId: string | undefined;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/access', 'DELETE');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const { searchParams } = new URL(request.url);
        const accessId = searchParams.get('id');

        if (!accessId) {
            logWarning('/api/access', 'validation-failed', 'Missing access ID');
            return NextResponse.json({ error: 'Access ID required', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const adminClient = createAdminClient();

        // Verify ownership through file
        const { data: access, error: fetchError } = await adminClient
            .from('file_access')
            .select('*, files!inner(*)')
            .eq('id', accessId)
            .single();

        if (fetchError || !access || access.files.uploaded_by !== user.id) {
            logWarning('/api/access', 'access-verification', 'Access grant not found or unauthorized', {
                accessId: accessId.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Access grant not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        // Delete access grant
        const { error: deleteError } = await adminClient
            .from('file_access')
            .delete()
            .eq('id', accessId);

        if (deleteError) {
            logError('/api/access', user.id, 'delete-access-grant', deleteError, {
                accessId: accessId.substring(0, 8),
            });
            return NextResponse.json({ error: 'Failed to delete access grant', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('/api/access', userId, 'DELETE-access-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_ACCESS_DELETE' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/access', 'PATCH');
        if (user instanceof NextResponse) return user;

        const body = await request.json();
        const { accessId, password, expiresAt, maxDownloads, resetDownloads } = body;

        if (!accessId) {
            return NextResponse.json({ error: 'Access ID required' }, { status: 400 });
        }

        const adminClient = createAdminClient();

        // Verify ownership through file
        const { data: access, error: fetchError } = await adminClient
            .from('file_access')
            .select('*, files!inner(*)')
            .eq('id', accessId)
            .single();

        if (fetchError || !access || access.files.uploaded_by !== user.id) {
            return NextResponse.json({ error: 'Access grant not found' }, { status: 404 });
        }

        const invalidSetting = validateAccessSettings({ password, expiresAt, maxDownloads });
        if (invalidSetting) {
            return NextResponse.json({ error: invalidSetting, code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        // Build update object with only provided fields
        const updateData: FileAccessUpdate = {
            session_token: null,  // Always invalidate session on edit
            session_expires_at: null,
        };

        // Only update password if provided (user wants to change it)
        if (password) {
            updateData.password_hash = await hashPassword(password);
        }

        // Handle expiry - can be set, changed, or removed (null)
        if (expiresAt !== undefined) {
            updateData.expires_at = expiresAt || null;
        }

        // Handle max downloads - can be set, changed, or removed (null)
        if (maxDownloads !== undefined) {
            updateData.max_downloads = maxDownloads || null;
        }

        // Optionally reset download counter (for re-granting access)
        if (resetDownloads) {
            updateData.download_count = 0;
        }

        const { data: updatedAccess, error: updateError } = await adminClient
            .from('file_access')
            .update(updateData)
            .eq('id', accessId)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update access grant' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            access: serializeAccess(updatedAccess),
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
