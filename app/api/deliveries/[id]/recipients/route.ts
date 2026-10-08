import { NextRequest, NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireOwner, serverError } from '@/lib/deliveries/http';
import { addRecipients, loadOwnedDelivery } from '@/lib/deliveries/owner';
import { getOwnerSettings, getSender } from '@/lib/deliveries/settings';
import type { RecipientInput } from '@/lib/deliveries/deliveries';

const ROUTE = '/api/deliveries/[id]/recipients';
type Params = { params: Promise<{ id: string }> };

/**
 * POST { people?: RecipientInput[], anyone?: RecipientInput, sendInvites?: boolean }
 * Each person gets their own password when using passwords; passwords are returned once.
 */
export async function POST(request: NextRequest, { params }: Params) {
    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    try {
        const { id } = await params;
        const delivery = isUuid(id) ? await loadOwnedDelivery(user.id, id) : null;
        if (!delivery) return jsonError("That delivery doesn't exist.", 404, 'ERR_NOT_FOUND');

        const body = await readJson(request);
        const [settings, sender] = await Promise.all([getOwnerSettings(user.id), getSender(user.id)]);
        const result = await addRecipients(
            delivery,
            settings,
            sender,
            {
                people: Array.isArray(body.people) ? (body.people as RecipientInput[]) : [],
                anyone: (body.anyone as RecipientInput) ?? null,
                sendInvites: body.sendInvites !== false,
            },
            request,
        );
        if ('error' in result) return jsonError(result.error, 400, 'ERR_INVALID_INPUT');
        return NextResponse.json({ recipients: result.recipients }, { status: 201 });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}
