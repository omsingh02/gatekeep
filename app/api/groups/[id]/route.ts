import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { sanitizeGroupName, sanitizeText } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';

// Helper: Get all descendant group IDs recursively
async function getDescendantGroupIds(adminClient: any, groupId: string, userId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue = [groupId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const { data: children } = await adminClient
            .from('groups')
            .select('id')
            .eq('parent_id', currentId)
            .eq('created_by', userId)
            .is('deleted_at', null);

        if (children) {
            for (const child of children) {
                descendants.push(child.id);
                queue.push(child.id);
            }
        }
    }

    return descendants;
}

// Helper: Check if targetId is a descendant of groupId (would cause circular reference)
async function isDescendant(adminClient: any, groupId: string, targetId: string, userId: string): Promise<boolean> {
    const descendants = await getDescendantGroupIds(adminClient, groupId, userId);
    return descendants.includes(targetId);
}

// Helper: Get group path/breadcrumbs
async function getGroupPath(adminClient: any, groupId: string, userId: string): Promise<Array<{ id: string; name: string }>> {
    const path: Array<{ id: string; name: string }> = [];
    let currentId: string | null = groupId;

    while (currentId) {
        const { data: group } = await adminClient
            .from('groups')
            .select('id, name, parent_id')
            .eq('id', currentId)
            .eq('created_by', userId)
            .is('deleted_at', null)
            .single();

        if (!group) break;

        path.unshift({ id: group.id, name: group.name });
        currentId = group.parent_id;
    }

    return path;
}

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
            .select('id, name, description, parent_id, created_at, updated_at, group_members(id, member_identifier)')
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

        // Get group stats and path
        const [subgroupCount, path] = await Promise.all([
            adminClient
                .from('groups')
                .select('id', { count: 'exact', head: true })
                .eq('parent_id', id)
                .eq('created_by', user.id)
                .is('deleted_at', null),
            getGroupPath(adminClient, id, user.id),
        ]);

        const g = group as any;
        return NextResponse.json({
            group: {
                id: g.id,
                name: g.name,
                description: g.description,
                parentId: g.parent_id,
                createdAt: g.created_at,
                updatedAt: g.updated_at,
                memberCount: (g.group_members || []).length,
                subgroupCount: subgroupCount.count || 0,
                path,
                members: (g.group_members || []).map((m: any) => ({
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
        const { name, description, parentId } = body || {};

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
            updateData.name = sanitizedName;
        }

        if (description !== undefined) {
            updateData.description = description ? sanitizeText(description, 500) : null;
        }

        if (parentId !== undefined) {
            if (parentId === id) {
                return NextResponse.json({ error: 'Group cannot be its own parent', code: 'ERR_INVALID_INPUT' }, { status: 400 });
            }

            if (parentId) {
                const { data: parent, error: parentError } = await adminClient
                    .from('groups')
                    .select('id')
                    .eq('id', parentId)
                    .eq('created_by', user.id)
                    .is('deleted_at', null)
                    .single();

                if (parentError || !parent) {
                    return NextResponse.json({ error: 'Parent group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
                }

                // Prevent circular reference: target parent cannot be a descendant
                const wouldCycle = await isDescendant(adminClient, id, parentId, user.id);
                if (wouldCycle) {
                    return NextResponse.json({ error: 'Cannot move group into its own subgroup', code: 'ERR_CIRCULAR_REF' }, { status: 400 });
                }
            }

            updateData.parent_id = parentId || null;
        }

        // Check duplicate name within same parent if name changes
        if (updateData.name) {
            const parentForCheck = updateData.parent_id !== undefined ? updateData.parent_id : (group as any).parent_id;

            let conflictQuery = adminClient
                .from('groups')
                .select('id')
                .eq('created_by', user.id)
                .eq('name', updateData.name)
                .is('deleted_at', null)
                .neq('id', id);

            if (parentForCheck) {
                conflictQuery = conflictQuery.eq('parent_id', parentForCheck);
            } else {
                conflictQuery = conflictQuery.is('parent_id', null);
            }

            const { data: conflict } = await conflictQuery.maybeSingle();

            if (conflict) {
                return NextResponse.json({ error: 'A group with that name already exists here', code: 'ERR_CONFLICT' }, { status: 409 });
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true });
        }

        const { data: updated, error: updateError } = await adminClient
            .from('groups')
            .update(updateData as never)
            .eq('id', id)
            .select('id, name, description, parent_id, created_at, updated_at')
            .single();

        if (updateError || !updated) {
            logError('/api/groups/[id]', user.id, 'update-group', updateError);
            return NextResponse.json({ error: 'Failed to update group', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        const u = updated as any;
        return NextResponse.json({
            group: {
                id: u.id,
                name: u.name,
                description: u.description,
                parentId: u.parent_id,
                createdAt: u.created_at,
                updatedAt: u.updated_at,
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

        const deletedAt = new Date().toISOString();

        // Get all descendant group IDs
        const descendantIds = await getDescendantGroupIds(adminClient, id, user.id);
        const allGroupIds = [id, ...descendantIds];

        // Soft delete all groups (parent + descendants)
        const { error: deleteError } = await adminClient
            .from('groups')
            .update({ deleted_at: deletedAt } as never)
            .in('id', allGroupIds);

        if (deleteError) {
            logError('/api/groups/[id]', user.id, 'delete-group', deleteError);
            return NextResponse.json({ error: 'Failed to delete group', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Remove file_access entries that reference deleted groups
        await adminClient
            .from('file_access')
            .delete()
            .in('group_id', allGroupIds);

        return NextResponse.json({
            success: true,
            deletedGroups: allGroupIds.length,
        });
    } catch (error) {
        logError('/api/groups/[id]', user?.id, 'DELETE-group', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_DELETE' }, { status: 500 });
    }
}
