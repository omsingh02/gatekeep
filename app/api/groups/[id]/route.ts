import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { sanitizeGroupName, sanitizeText } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let user: any;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/groups/[id]', 'GET');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();
        const { data: group, error } = await adminClient
            .from('groups')
            .select('id, name, description, created_at, updated_at, group_members(id, member_identifier)')
            .eq('id', id)
            .eq('created_by', user.id)
            .is('deleted_at', null)
            .single();

        if (error || !group) {
            logWarning('/api/groups/[id]', 'group-not-found', 'Group not found or unauthorized', {
                groupId: id.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        return NextResponse.json({
            group: {
                id: group.id,
                name: group.name,
                description: group.description,
                createdAt: group.created_at,
                updatedAt: group.updated_at,
                members: (group.group_members || []).map((m: any) => ({
                    id: m.id,
                    memberIdentifier: m.member_identifier,
                })),
            },
        });
    } catch (error) {
        logError('/api/groups/[id]', user?.id, 'GET-group', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_GET' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let user: any;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/groups/[id]', 'PATCH');
        if (user instanceof NextResponse) return user;

        const body = await request.json();
        const { name, description } = body || {};

        const adminClient = createAdminClient();

        const { data: group, error: fetchError } = await adminClient
            .from('groups')
            .select('*')
            .eq('id', id)
            .eq('created_by', user.id)
            .is('deleted_at', null)
            .single();

        if (fetchError || !group) {
            return NextResponse.json({ error: 'Group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const updateData: Record<string, any> = {};
        if (name !== undefined) {
            const sanitizedName = sanitizeGroupName(name || '');
            if (!sanitizedName) {
                return NextResponse.json({ error: 'Invalid group name', code: 'ERR_INVALID_INPUT' }, { status: 400 });
            }

            // Check duplicate name
            const { data: conflict } = await adminClient
                .from('groups')
                .select('id')
                .eq('created_by', user.id)
                .eq('name', sanitizedName)
                .is('deleted_at', null)
                .neq('id', id)
                .maybeSingle();

            if (conflict) {
                return NextResponse.json({ error: 'A group with that name already exists', code: 'ERR_CONFLICT' }, { status: 409 });
            }

            updateData.name = sanitizedName;
        }

        if (description !== undefined) {
            updateData.description = description ? sanitizeText(description, 500) : null;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true });
        }

        const { data: updated, error: updateError } = await adminClient
            .from('groups')
            .update(updateData as never)
            .eq('id', id)
            .select('id, name, description, created_at, updated_at')
            .single();

        if (updateError || !updated) {
            logError('/api/groups/[id]', user.id, 'update-group', updateError);
            return NextResponse.json({ error: 'Failed to update group', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({
            group: {
                id: updated.id,
                name: updated.name,
                description: updated.description,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
            },
        });
    } catch (error) {
        logError('/api/groups/[id]', user?.id, 'PATCH-group', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_PATCH' }, { status: 500 });
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
        user = validateAuth(userData, '/api/groups/[id]', 'DELETE');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();

        const { data: group, error: fetchError } = await adminClient
            .from('groups')
            .select('id')
            .eq('id', id)
            .eq('created_by', user.id)
            .is('deleted_at', null)
            .single();

        if (fetchError || !group) {
            return NextResponse.json({ error: 'Group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const { error: deleteError } = await adminClient
            .from('groups')
            .update({ deleted_at: new Date().toISOString() } as never)
            .eq('id', id);

        if (deleteError) {
            logError('/api/groups/[id]', user.id, 'delete-group', deleteError);
            return NextResponse.json({ error: 'Failed to delete group', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('/api/groups/[id]', user?.id, 'DELETE-group', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_DELETE' }, { status: 500 });
    }
}
