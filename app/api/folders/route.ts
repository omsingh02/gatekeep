import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { sanitizeFolderName } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
    let userId: string | undefined;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/folders', 'GET');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const { searchParams } = new URL(request.url);
        const parentId = searchParams.get('parentId');

        const adminClient = createAdminClient();

        if (parentId) {
            const { data: parent, error: parentError } = await adminClient
                .from('folders')
                .select('id')
                .eq('id', parentId)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .single();

            if (parentError || !parent) {
                logWarning('/api/folders', 'parent-not-found', 'Parent folder missing or unauthorized', {
                    parentId: parentId.substring(0, 8),
                    userId: user.id.substring(0, 8),
                });
                return NextResponse.json({ error: 'Parent folder not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
            }
        }

        let query = adminClient
            .from('folders')
            .select('*')
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (parentId) {
            query = query.eq('parent_id', parentId);
        } else {
            query = query.is('parent_id', null);
        }

        const { data: folders, error } = await query;

        if (error) {
            logError('/api/folders', user.id, 'fetch-folders', error);
            return NextResponse.json({ error: 'Failed to fetch folders', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        const transformed = (folders || []).map((folder) => ({
            id: folder.id,
            name: folder.name,
            parentId: folder.parent_id,
            uploadedBy: folder.uploaded_by,
            createdAt: folder.created_at,
            updatedAt: folder.updated_at,
        }));

        return NextResponse.json({ folders: transformed });
    } catch (error) {
        logError('/api/folders', userId, 'GET-folders', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDERS_GET' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let userId: string | undefined;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/folders', 'POST');
        if (user instanceof NextResponse) return user;
        userId = user.id;

        const body = await request.json();
        const { name, parentId } = body || {};

        const sanitizedName = sanitizeFolderName(name || '');
        if (!sanitizedName) {
            return NextResponse.json({ error: 'Invalid folder name', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const adminClient = createAdminClient();

        if (parentId) {
            const { data: parent, error: parentError } = await adminClient
                .from('folders')
                .select('id')
                .eq('id', parentId)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .single();

            if (parentError || !parent) {
                logWarning('/api/folders', 'parent-not-found', 'Parent folder missing or unauthorized', {
                    parentId: parentId.substring(0, 8),
                    userId: user.id.substring(0, 8),
                });
                return NextResponse.json({ error: 'Parent folder not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
            }
        }

        // Prevent duplicate names within the same parent for this user
        // .eq('parent_id', null) would compare against the string "null"; root needs IS NULL
        const siblings = adminClient
            .from('folders')
            .select('id')
            .eq('uploaded_by', user.id)
            .eq('name', sanitizedName)
            .is('deleted_at', null);
        const { data: existing } = await (parentId
            ? siblings.eq('parent_id', parentId)
            : siblings.is('parent_id', null)
        ).maybeSingle();

        if (existing) {
            return NextResponse.json({ error: 'A folder with that name already exists here', code: 'ERR_CONFLICT' }, { status: 409 });
        }

        const { data: folder, error } = await adminClient
            .from('folders')
            .insert({
                name: sanitizedName,
                parent_id: parentId || null,
                uploaded_by: user.id,
            })
            .select()
            .single();

        if (error || !folder) {
            logError('/api/folders', user.id, 'create-folder', error);
            return NextResponse.json({ error: 'Failed to create folder', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({
            folder: {
                id: folder.id,
                name: folder.name,
                parentId: folder.parent_id,
                uploadedBy: folder.uploaded_by,
                createdAt: folder.created_at,
                updatedAt: folder.updated_at,
            },
        });
    } catch (error) {
        logError('/api/folders', userId, 'POST-folders', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FOLDERS_POST' }, { status: 500 });
    }
}
