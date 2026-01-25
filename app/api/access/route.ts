import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPassword } from '@/lib/utils/crypto';
import { rateLimit, getClientIdentifier } from '@/lib/utils/ratelimit';
import { sanitizeUserIdentifier } from '@/lib/utils/sanitization';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
                return NextResponse.json({ error: 'File not found' }, { status: 404 });
            }

            // Get access list for this file
            const { data: access, error: accessError } = await adminClient
                .from('file_access')
                .select('*')
                .eq('file_id', fileId)
                .order('created_at', { ascending: false });

            if (accessError) {
                return NextResponse.json({ error: 'Failed to fetch access list' }, { status: 500 });
            }

            // Transform to camelCase
            const transformedAccess = (access || []).map((a: any) => ({
                id: a.id,
                fileId: a.file_id,
                userIdentifier: a.user_identifier,
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

        // Get all shares for the user (across all their files)
        // First get total count
        const { count: totalCount } = await adminClient
            .from('file_access')
            .select('*, files!inner(*)', { count: 'exact', head: true })
            .eq('files.uploaded_by', user.id);

        // Build query for all shares with file info
        let query = adminClient
            .from('file_access')
            .select('*, files!inner(id, original_filename, short_code, uploaded_by)')
            .eq('files.uploaded_by', user.id)
            .order('created_at', { ascending: false });

        if (limitNum && limitNum > 0) {
            query = query.limit(limitNum);
        }

        const { data: access, error: accessError } = await query;

        if (accessError) {
            return NextResponse.json({ error: 'Failed to fetch access list' }, { status: 500 });
        }

        // Transform to camelCase with file info
        const transformedAccess = (access || []).map((a: any) => ({
            id: a.id,
            fileId: a.file_id,
            userIdentifier: a.user_identifier,
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
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting: 20 access grants per minute per IP
        const identifier = getClientIdentifier(request);
        const { success } = rateLimit(identifier, 20, 60 * 1000);
        
        if (!success) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { fileId, userIdentifier, password, expiresAt, maxDownloads } = body;

        if (!fileId || !userIdentifier || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Sanitize user identifier to prevent XSS
        const sanitizedUserIdentifier = sanitizeUserIdentifier(userIdentifier);
        if (!sanitizedUserIdentifier) {
            return NextResponse.json({ error: 'Invalid user identifier' }, { status: 400 });
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
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create access grant
        const { data: access, error: accessError } = await adminClient
            .from('file_access')
            .insert({
                file_id: fileId,
                user_identifier: sanitizedUserIdentifier,
                password_hash: passwordHash,
                expires_at: expiresAt || null,
                max_downloads: maxDownloads || null,
            } as any)
            .select()
            .single();

        if (accessError) {
            return NextResponse.json({ error: 'Failed to create access grant' }, { status: 500 });
        }

        return NextResponse.json({ success: true, access });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const accessId = searchParams.get('id');

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

        // Delete access grant
        const { error: deleteError } = await adminClient
            .from('file_access')
            .delete()
            .eq('id', accessId);

        if (deleteError) {
            return NextResponse.json({ error: 'Failed to delete access grant' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
