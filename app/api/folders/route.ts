import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/api/http';
import { FOLDER_COLUMNS, folderNameInUse, loadOwnedFolder, serializeFolder } from '@/lib/files/library';
import { FILE_MESSAGES, folderNameTaken, folderTooDeep, parseFolderName } from '@/lib/files/rules';

const ROUTE = '/api/folders';

/**
 * GET /api/folders?parentId=&all=true → { folders }
 * The top-level folders, the folders inside parentId, or with all=true every folder (for Move). Oldest first.
 */
export async function GET(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const params = request.nextUrl.searchParams;
        const parentId = params.get('parentId');
        if (parentId && !(await loadOwnedFolder(user.id, parentId))) return jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');

        let query = createAdminClient()
            .from('folders')
            .select(FOLDER_COLUMNS)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
        if (params.get('all') !== 'true') query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ folders: (data ?? []).map(serializeFolder) });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}

/**
 * POST /api/folders  { name, parentId? } → 201 { folder }
 * Creates a folder at the top level, or inside a top-level folder (folders are one level deep).
 */
export async function POST(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    try {
        const body = await readJson(request);
        const name = parseFolderName(body.name);
        if ('error' in name) return jsonError(name.error, 400, 'ERR_INVALID_INPUT');

        let parentId: string | null = null;
        if (body.parentId !== undefined && body.parentId !== null) {
            const parent = await loadOwnedFolder(user.id, body.parentId);
            if (!parent) return jsonError(FILE_MESSAGES.folderNotFound, 404, 'ERR_NOT_FOUND');
            if (parent.parent_id) return jsonError(folderTooDeep(name.value), 400, 'ERR_MAX_DEPTH');
            parentId = parent.id;
        }

        if (await folderNameInUse(user.id, name.value, parentId)) return jsonError(folderNameTaken(name.value), 409, 'ERR_CONFLICT');

        const { data: folder, error } = await createAdminClient()
            .from('folders')
            .insert({ name: name.value, parent_id: parentId, uploaded_by: user.id })
            .select(FOLDER_COLUMNS)
            .single();
        if (error || !folder) throw error ?? new Error('Insert failed');

        return NextResponse.json({ folder: serializeFolder(folder) }, { status: 201 });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}
