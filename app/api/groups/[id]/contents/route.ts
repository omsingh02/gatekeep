import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
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
        user = validateAuth(userData, '/api/groups/[id]/contents', 'GET');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();

        // Verify group exists and belongs to user
        const { data: group, error: groupError } = await adminClient
            .from('groups')
            .select('id, name, description, parent_id')
            .eq('id', id)
            .eq('created_by', user.id)
            .is('deleted_at', null)
            .single();

        if (groupError || !group) {
            logWarning('/api/groups/[id]/contents', 'group-not-found', 'Group not found or unauthorized', {
                groupId: id.substring(0, 8),
                userId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        // Get breadcrumb path
        const path: Array<{ id: string; name: string }> = [];
        let currentId: string | null = id;
        while (currentId) {
            const { data: pathGroup } = await adminClient
                .from('groups')
                .select('id, name, parent_id')
                .eq('id', currentId)
                .eq('created_by', user.id)
                .is('deleted_at', null)
                .single();

            if (!pathGroup) break;
            const pg = pathGroup as any;
            path.unshift({ id: pg.id, name: pg.name });
            currentId = pg.parent_id;
        }

        // Get subgroups and members in parallel
        const [subgroupsResult, membersResult] = await Promise.all([
            adminClient
                .from('groups')
                .select('id, name, description, parent_id, created_at, updated_at')
                .eq('parent_id', id)
                .eq('created_by', user.id)
                .is('deleted_at', null)
                .order('name', { ascending: true }),
            adminClient
                .from('group_members')
                .select('id, member_identifier, created_at')
                .eq('group_id', id)
                .order('member_identifier', { ascending: true }),
        ]);

        if (subgroupsResult.error) {
            logError('/api/groups/[id]/contents', user.id, 'fetch-subgroups', subgroupsResult.error);
            return NextResponse.json({ error: 'Failed to fetch subgroups', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        if (membersResult.error) {
            logError('/api/groups/[id]/contents', user.id, 'fetch-members', membersResult.error);
            return NextResponse.json({ error: 'Failed to fetch members', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        // Get subgroup stats (member count and subgroup count for each)
        const subgroupIds = (subgroupsResult.data || []).map((g: any) => g.id);
        const subgroupStats: Record<string, { memberCount: number; subgroupCount: number }> = {};

        if (subgroupIds.length > 0) {
            for (const sgId of subgroupIds) {
                const [memberCount, subCount] = await Promise.all([
                    adminClient
                        .from('group_members')
                        .select('id', { count: 'exact', head: true })
                        .eq('group_id', sgId),
                    adminClient
                        .from('groups')
                        .select('id', { count: 'exact', head: true })
                        .eq('parent_id', sgId)
                        .eq('created_by', user.id)
                        .is('deleted_at', null),
                ]);
                subgroupStats[sgId] = {
                    memberCount: memberCount.count || 0,
                    subgroupCount: subCount.count || 0,
                };
            }
        }

        const subgroups = (subgroupsResult.data || []).map((g: any) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            parentId: g.parent_id,
            createdAt: g.created_at,
            updatedAt: g.updated_at,
            memberCount: subgroupStats[g.id]?.memberCount || 0,
            subgroupCount: subgroupStats[g.id]?.subgroupCount || 0,
        }));

        const members = (membersResult.data || []).map((m: any) => ({
            id: m.id,
            memberIdentifier: m.member_identifier,
            createdAt: m.created_at,
        }));

        const g = group as any;
        return NextResponse.json({
            group: {
                id: g.id,
                name: g.name,
                description: g.description,
                parentId: g.parent_id,
            },
            path,
            subgroups,
            members,
            totalItems: subgroups.length + members.length,
        });
    } catch (error) {
        logError('/api/groups/[id]/contents', user?.id, 'GET-contents', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_CONTENTS' }, { status: 500 });
    }
}
