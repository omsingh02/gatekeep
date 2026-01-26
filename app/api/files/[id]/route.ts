import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError, logWarning } from '@/lib/utils/logger';
import { validateAuth } from '@/lib/utils/validation';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let user: any;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/files/[id]', 'GET');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();
        const { data: file, error } = await adminClient
            .from('files')
            .select('*')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .single();

        if (error || !file) {
            logWarning('/api/files/[id]', 'file-access', 'File not found or unauthorized', {
                fileId: id.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'File not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        return NextResponse.json({ file });
    } catch (error) {
        logError('/api/files/[id]', user?.id, 'GET-file-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FILE_GET' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let user: any;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/files/[id]', 'DELETE');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();

        // Step 1: Use database transaction to soft-delete and get filename
        // This is atomic - either fully succeeds or fully rolls back
        // Type assertion needed because Supabase types don't know about custom RPC functions
        const { data: deleteResult, error: rpcError } = await (adminClient
            .rpc as any)('soft_delete_file', {
                p_file_id: id,
                p_user_id: user.id,
            });

        if (rpcError) {
            logError('/api/files/[id]', user.id, 'soft-delete-file', rpcError, {
                fileId: id.substring(0, 8),
            });
            // Fallback to direct query if RPC not available (migration not run yet)
            return await fallbackDelete(adminClient, id, user.id);
        }

        const result = deleteResult?.[0];
        if (!result?.success) {
            logWarning('/api/files/[id]', 'delete-validation', result?.error_message || 'Delete validation failed', {
                fileId: id.substring(0, 8),
            });
            return NextResponse.json(
                { error: result?.error_message || 'Failed to delete file', code: 'ERR_DELETE_FAILED' },
                { status: result?.error_message === 'Unauthorized' ? 403 : 404 }
            );
        }

        // Step 2: Delete from storage (file is already soft-deleted in DB)
        const { error: storageError } = await adminClient.storage
            .from('files')
            .remove([result.filename]);

        if (storageError) {
            // Storage deletion failed, but file is soft-deleted
            // It will be cleaned up later or can be retried
            logWarning('/api/files/[id]', 'storage-deletion', 'Failed to delete from storage', {
                fileId: id.substring(0, 8),
                filename: result.filename?.substring(0, 20),
            });
            // Still return success - the file is effectively deleted from user's view
        }

        // Step 3: Complete the deletion (hard delete from DB)
        // Type assertion needed because Supabase types don't know about custom RPC functions
        await (adminClient.rpc as any)('complete_file_deletion', { p_file_id: id });

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('/api/files/[id]', user?.id, 'DELETE-file-request', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_FILE_DELETE' }, { status: 500 });
    }
}

/**
 * Fallback delete method for when the RPC functions haven't been migrated yet.
 * Uses the original non-transactional approach.
 */
async function fallbackDelete(
    adminClient: ReturnType<typeof createAdminClient>,
    fileId: string,
    userId: string
) {
    // Get file info
    const { data: file, error: fetchError } = await adminClient
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('uploaded_by', userId)
        .single();

    if (fetchError || !file) {
        logWarning('/api/files/[id]', 'fallback-delete', 'File not found in fallback deletion', {
            fileId: fileId.substring(0, 8),
        });
        return NextResponse.json({ error: 'File not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
    }

    // Delete from storage first
    await adminClient.storage.from('files').remove([(file as any).filename]);

    // Delete from database (cascades to file_access and access_log)
    const { error: deleteError } = await adminClient
        .from('files')
        .delete()
        .eq('id', fileId);

    if (deleteError) {
        logError('/api/files/[id]', userId, 'fallback-delete', deleteError, {
            fileId: fileId.substring(0, 8),
        });
        return NextResponse.json({ error: 'Failed to delete file', code: 'ERR_DB_ERROR' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
