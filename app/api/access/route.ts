import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPassword } from '@/lib/utils/crypto';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { sanitizeUserIdentifier } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';
import { validateAuth, validateAndSanitize } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
    let user: any;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/access', 'GET');
        if (user instanceof NextResponse) return user;

        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get('fileId');
        const limit = searchParams.get('limit');
        const limitNum = limit ? parseInt(limit, 10) : null;

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
                .select('*, groups:group_id(name)')
                .eq('file_id', fileId)
                .order('created_at', { ascending: false });

            if (accessError) {
                logError('/api/access', user.id, 'fetch-access-list', accessError, {
                    fileId: fileId.substring(0, 8),
                });
                return NextResponse.json({ error: 'Failed to fetch access list', code: 'ERR_DB_ERROR' }, { status: 500 });
            }

            // Transform to camelCase
            const transformedAccess = (access || []).map((a: any) => ({
                id: a.id,
                fileId: a.file_id,
                type: a.group_id ? 'group' : 'user',
                userIdentifier: a.user_identifier || undefined,
                groupId: a.group_id,
                groupName: (a as any).groups?.name,
                passwordHash: a.password_hash,
                expiresAt: a.expires_at,
                accessCount: a.access_count,
                downloadCount: a.download_count,
                maxDownloads: a.max_downloads,
                lastAccessed: a.last_accessed,
                createdAt: a.created_at,
            }));

            return NextResponse.json({ access: transformedAccess });
        }

        // Get all shares for the user (across all their files) with count in single query
        let query = adminClient
            .from('file_access')
            .select('*, files!inner(id, original_filename, short_code, uploaded_by), groups:group_id(name)', { count: 'exact' })
            .eq('files.uploaded_by', user.id)
            .order('created_at', { ascending: false });

        if (limitNum && limitNum > 0) {
            query = query.limit(limitNum);
        }

        const { data: access, count: totalCount, error: accessError } = await query;

        if (accessError) {
            logError('/api/access', user.id, 'fetch-all-access', accessError);
            return NextResponse.json({ error: 'Failed to fetch access list', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Transform to camelCase with file info
        const transformedAccess = (access || []).map((a: any) => ({
            id: a.id,
            fileId: a.file_id,
            type: a.group_id ? 'group' : 'user',
            userIdentifier: a.user_identifier || undefined,
            groupId: a.group_id,
            groupName: (a as any).groups?.name,
            passwordHash: a.password_hash,
            expiresAt: a.expires_at,
            accessCount: a.access_count,
            downloadCount: a.download_count,
            maxDownloads: a.max_downloads,
            lastAccessed: a.last_accessed,
            createdAt: a.created_at,
            file: {
                id: a.files.id,
                originalFilename: a.files.original_filename,
                shortCode: a.files.short_code,
            },
        }));

        return NextResponse.json({ access: transformedAccess, totalCount: totalCount || 0 });
    } catch (error) {
        logError('/api/access', user?.id, 'GET-access-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_ACCESS_GET' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let user: any;
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
        user = validateAuth(userData, '/api/access', 'POST');
        if (user instanceof NextResponse) return user;

        const body = await request.json();
        const { fileId, userIdentifier, password, expiresAt, maxDownloads, groupId } = body;

        if (!fileId || !password || (!userIdentifier && !groupId)) {
            logWarning('/api/access', 'validation-failed', 'Missing required fields', { fileId: fileId || 'none' });
            return NextResponse.json({ error: 'fileId, password, and a user or group are required', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        if (userIdentifier && groupId) {
            return NextResponse.json({ error: 'Choose either a user or a group, not both', code: 'ERR_INVALID_INPUT' }, { status: 400 });
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

        if (groupId) {
            const { data: group, error: groupError } = await adminClient
                .from('groups')
                .select('id')
                .eq('id', groupId)
                .eq('created_by', user.id)
                .is('deleted_at', null)
                .single();

            if (groupError || !group) {
                return NextResponse.json({ error: 'Group not found', code: 'ERR_GROUP_NOT_FOUND' }, { status: 404 });
            }
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

        if (groupId) {
            const { data: existingGroupAccess } = await adminClient
                .from('file_access')
                .select('id')
                .eq('file_id', fileId)
                .eq('group_id', groupId)
                .maybeSingle();

            if (existingGroupAccess) {
                return NextResponse.json(
                    { error: 'Group already has access to this file. Edit the existing grant instead.', code: 'ERR_CONFLICT' },
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
                group_id: groupId || null,
                password_hash: passwordHash,
                expires_at: expiresAt || null,
                max_downloads: maxDownloads || null,
            } as any)
            .select()
            .single();

        if (accessError) {
            logError('/api/access', user.id, 'create-access-grant', accessError, {
                fileId: fileId.substring(0, 8),
                userIdentifier: sanitizedUserIdentifier?.substring(0, 10),
                groupId: groupId?.substring(0, 8),
            });
            return NextResponse.json({ error: 'Failed to create access grant', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            access: {
                id: access.id,
                fileId: access.file_id,
                type: groupId ? 'group' : 'user',
                userIdentifier: access.user_identifier || undefined,
                groupId: access.group_id,
                passwordHash: access.password_hash,
                expiresAt: access.expires_at,
                accessCount: access.access_count,
                downloadCount: access.download_count,
                maxDownloads: access.max_downloads,
                lastAccessed: access.last_accessed,
                createdAt: access.created_at,
            },
        });
    } catch (error) {
        logError('/api/access', user?.id, 'POST-access-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_ACCESS_POST' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    let user: any;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/access', 'DELETE');
        if (user instanceof NextResponse) return user;

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

        if (fetchError || !access || (access as any).files?.uploaded_by !== user.id) {
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
        logError('/api/access', user?.id, 'DELETE-access-request', error);
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

        if (fetchError || !access || (access as any).files?.uploaded_by !== user.id) {
            return NextResponse.json({ error: 'Access grant not found' }, { status: 404 });
        }

        // Build update object with only provided fields
        const updateData: any = {
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
            .update(updateData as never)
            .eq('id', accessId)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update access grant' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            access: {
                ...updatedAccess,
                type: (updatedAccess as any).group_id ? 'group' : 'user',
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
