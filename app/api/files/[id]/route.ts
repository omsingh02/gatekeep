import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminClient = createAdminClient();
        const { data: file, error } = await adminClient
            .from('files')
            .select('*')
            .eq('id', id)
            .eq('uploaded_by', user.id)
            .is('deleted_at', null)
            .single();

        if (error || !file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        return NextResponse.json({ file });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
            console.error('RPC error:', rpcError);
            // Fallback to direct query if RPC not available (migration not run yet)
            return await fallbackDelete(adminClient, id, user.id);
        }

        const result = deleteResult?.[0];
        if (!result?.success) {
            return NextResponse.json(
                { error: result?.error_message || 'Failed to delete file' },
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
            console.error('Storage deletion failed:', storageError);
            // Still return success - the file is effectively deleted from user's view
        }

        // Step 3: Complete the deletion (hard delete from DB)
        await adminClient.rpc('complete_file_deletion', { p_file_id: id });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete from storage first
    await adminClient.storage.from('files').remove([(file as any).filename]);

    // Delete from database (cascades to file_access and access_log)
    const { error: deleteError } = await adminClient
        .from('files')
        .delete()
        .eq('id', fileId);

    if (deleteError) {
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
