import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { sanitizeGroupName, sanitizeText, sanitizeUserIdentifier } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
    let user: any;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/groups', 'GET');
        if (user instanceof NextResponse) return user;

        const { searchParams } = new URL(request.url);
        const parentId = searchParams.get('parentId');

        const adminClient = createAdminClient();

        // If parentId specified, verify it exists and belongs to user
        if (parentId) {
            const { data: parent, error: parentError } = await adminClient
                .from('groups')
                .select('id')
                .eq('id', parentId)
                .eq('created_by', user.id)
                .is('deleted_at', null)
                .single();

            if (parentError || !parent) {
                logWarning('/api/groups', 'parent-not-found', 'Parent group missing or unauthorized', {
                    parentId: parentId.substring(0, 8),
                    userId: user.id.substring(0, 8),
                });
                return NextResponse.json({ error: 'Parent group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
            }
        }

        let query = adminClient
            .from('groups')
            .select('id, name, description, parent_id, created_at, updated_at, group_members(id, member_identifier)')
            .eq('created_by', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (parentId) {
            query = query.eq('parent_id', parentId);
        } else {
            query = query.is('parent_id', null);
        }

        const { data: groups, error } = await query;

        if (error) {
            logError('/api/groups', user.id, 'fetch-groups', error);
            return NextResponse.json({ error: 'Failed to fetch groups', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        const transformed = (groups || []).map((group: any) => ({
            id: group.id,
            name: group.name,
            description: group.description,
            parentId: group.parent_id,
            createdAt: group.created_at,
            updatedAt: group.updated_at,
            members: (group.group_members || []).map((m: any) => ({
                id: m.id,
                memberIdentifier: m.member_identifier,
            })),
        }));

        return NextResponse.json({ groups: transformed });
    } catch (error) {
        logError('/api/groups', user?.id, 'GET-groups', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUPS_GET' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let user: any;
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/groups', 'POST');
        if (user instanceof NextResponse) return user;

        const body = await request.json();
        const { name, description, members, parentId } = body || {};

        const sanitizedName = sanitizeGroupName(name || '');
        if (!sanitizedName) {
            return NextResponse.json({ error: 'Invalid group name', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const sanitizedDescription = description ? sanitizeText(description, 500) : null;

        const adminClient = createAdminClient();

        // If parentId specified, verify it exists and belongs to user
        if (parentId) {
            const { data: parent, error: parentError } = await adminClient
                .from('groups')
                .select('id')
                .eq('id', parentId)
                .eq('created_by', user.id)
                .is('deleted_at', null)
                .single();

            if (parentError || !parent) {
                logWarning('/api/groups', 'parent-not-found', 'Parent group missing or unauthorized', {
                    parentId: parentId.substring(0, 8),
                    userId: user.id.substring(0, 8),
                });
                return NextResponse.json({ error: 'Parent group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
            }
        }

        // Prevent duplicate names within same parent
        let conflictQuery = adminClient
            .from('groups')
            .select('id')
            .eq('created_by', user.id)
            .eq('name', sanitizedName)
            .is('deleted_at', null);

        if (parentId) {
            conflictQuery = conflictQuery.eq('parent_id', parentId);
        } else {
            conflictQuery = conflictQuery.is('parent_id', null);
        }

        const { data: conflict } = await conflictQuery.maybeSingle();

        if (conflict) {
            return NextResponse.json({ error: 'A group with that name already exists here', code: 'ERR_CONFLICT' }, { status: 409 });
        }

        const { data: group, error } = await adminClient
            .from('groups')
            .insert({
                name: sanitizedName,
                description: sanitizedDescription,
                parent_id: parentId || null,
                created_by: user.id,
            } as any)
            .select('id, name, description, parent_id, created_at, updated_at')
            .single();

        if (error || !group) {
            logError('/api/groups', user.id, 'create-group', error);
            return NextResponse.json({ error: 'Failed to create group', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        const g = group as { id: string; name: string; description: string | null; parent_id: string | null; created_at: string; updated_at: string };

        // Optionally add initial members
        if (Array.isArray(members) && members.length > 0) {
            const sanitizedMembers = members
                .map((m: string) => sanitizeUserIdentifier(m))
                .filter(Boolean)
                .map((m: string) => ({ group_id: g.id, member_identifier: m }));

            if (sanitizedMembers.length > 0) {
                await adminClient.from('group_members').insert(sanitizedMembers as any);
            }
        }

        return NextResponse.json({
            group: {
                id: g.id,
                name: g.name,
                description: g.description,
                parentId: g.parent_id,
                createdAt: g.created_at,
                updatedAt: g.updated_at,
                members: [],
            },
        });
    } catch (error) {
        logError('/api/groups', user?.id, 'POST-groups', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUPS_POST' }, { status: 500 });
    }
}
