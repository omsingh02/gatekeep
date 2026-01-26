import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';
import { sanitizeUserIdentifier } from '@/lib/utils/sanitization';
import { logError, logWarning } from '@/lib/utils/logger';

async function ensureOwnership(groupId: string, userId: string, adminClient: ReturnType<typeof createAdminClient>) {
    const { data: group, error } = await adminClient
        .from('groups')
        .select('id')
        .eq('id', groupId)
        .eq('created_by', userId)
        .is('deleted_at', null)
        .single();

    if (error || !group) return false;
    return true;
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
        user = validateAuth(userData, '/api/groups/[id]/members', 'GET');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();
        const owns = await ensureOwnership(id, user.id, adminClient);
        if (!owns) {
            return NextResponse.json({ error: 'Group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const { data: members, error } = await adminClient
            .from('group_members')
            .select('id, member_identifier')
            .eq('group_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            logError('/api/groups/[id]/members', user.id, 'fetch-members', error);
            return NextResponse.json({ error: 'Failed to fetch members', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        const transformed = (members || []).map((m: any) => ({
            id: m.id,
            memberIdentifier: m.member_identifier,
        }));

        return NextResponse.json({ members: transformed });
    } catch (error) {
        logError('/api/groups/[id]/members', user?.id, 'GET-members', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_MEMBERS_GET' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let user: any;
    try {
        const { id } = await params;
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        user = validateAuth(userData, '/api/groups/[id]/members', 'POST');
        if (user instanceof NextResponse) return user;

        const body = await request.json();
        const { memberIdentifier } = body || {};

        const adminClient = createAdminClient();
        const owns = await ensureOwnership(id, user.id, adminClient);
        if (!owns) {
            return NextResponse.json({ error: 'Group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const sanitizedIdentifier = sanitizeUserIdentifier(memberIdentifier || '');
        if (!sanitizedIdentifier) {
            return NextResponse.json({ error: 'Invalid member identifier', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const { data: existing } = await adminClient
            .from('group_members')
            .select('id')
            .eq('group_id', id)
            .eq('member_identifier', sanitizedIdentifier)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: 'Member already exists in this group', code: 'ERR_CONFLICT' }, { status: 409 });
        }

        const { data: member, error } = await adminClient
            .from('group_members')
            .insert({
                group_id: id,
                member_identifier: sanitizedIdentifier,
            } as any)
            .select('id, member_identifier')
            .single();

        if (error || !member) {
            logError('/api/groups/[id]/members', user.id, 'add-member', error);
            return NextResponse.json({ error: 'Failed to add member', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({
            member: {
                id: member.id,
                memberIdentifier: member.member_identifier,
            },
        });
    } catch (error) {
        logError('/api/groups/[id]/members', user?.id, 'POST-member', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_MEMBERS_POST' }, { status: 500 });
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
        user = validateAuth(userData, '/api/groups/[id]/members', 'DELETE');
        if (user instanceof NextResponse) return user;

        const { searchParams } = new URL(request.url);
        const memberId = searchParams.get('memberId');
        if (!memberId) {
            return NextResponse.json({ error: 'Member ID required', code: 'ERR_INVALID_INPUT' }, { status: 400 });
        }

        const adminClient = createAdminClient();
        const owns = await ensureOwnership(id, user.id, adminClient);
        if (!owns) {
            return NextResponse.json({ error: 'Group not found', code: 'ERR_NOT_FOUND' }, { status: 404 });
        }

        const { error } = await adminClient
            .from('group_members')
            .delete()
            .eq('id', memberId)
            .eq('group_id', id);

        if (error) {
            logError('/api/groups/[id]/members', user.id, 'delete-member', error);
            return NextResponse.json({ error: 'Failed to remove member', code: 'ERR_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('/api/groups/[id]/members', user?.id, 'DELETE-member', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_GROUP_MEMBERS_DELETE' }, { status: 500 });
    }
}
