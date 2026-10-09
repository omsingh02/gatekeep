import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/transport';
import { inviteEmail } from '@/lib/email/messages';
import { FILE_COLUMNS, serializeFile, type LibraryFile } from '@/lib/files/library';
import { recordActivity } from './activity';
import {
    inviteText,
    parseAnyoneRecipient,
    parsePersonRecipient,
    recipientLabel,
    serializeDeliverySummary,
    serializeRecipient,
    type Delivery,
    type ParsedRecipient,
    type Recipient,
    type RecipientInput,
} from './deliveries';
import { deliveryUrl } from './format';
import type { OwnerSettings, SenderIdentity } from './settings';

export async function loadOwnedDelivery(ownerId: string, id: string): Promise<Delivery | null> {
    const { data } = await createAdminClient()
        .from('deliveries')
        .select('*')
        .eq('id', id)
        .eq('owner_id', ownerId)
        .is('deleted_at', null)
        .maybeSingle();
    return data;
}

export interface DeliveryFile {
    id: string;
    name: string;
    size: number;
    mimeType: string;
}

export async function deliveryFiles(deliveryId: string): Promise<DeliveryFile[]> {
    const { data } = await createAdminClient()
        .from('delivery_files')
        .select('position, files!inner(id, original_filename, file_size, mime_type, deleted_at)')
        .eq('delivery_id', deliveryId)
        .is('files.deleted_at', null)
        .order('position', { ascending: true });
    return (data ?? []).map((row) => ({
        id: row.files.id,
        name: row.files.original_filename,
        size: row.files.file_size,
        mimeType: row.files.mime_type,
    }));
}

/** A file received on a request: the library file (lib/files/library.ts), and who sent it */
export interface ReceivedFile extends LibraryFile {
    /** Who uploaded it, as the owner sees them ("maya@acme.co"); null if they're no longer on the request */
    from: string | null;
}

const RECEIVED_LIMIT = 500;

/** Files people uploaded through a request that are still in the owner's files, newest first. */
export async function receivedFiles(delivery: Delivery, recipients: Recipient[]): Promise<ReceivedFile[]> {
    const { data, error } = await createAdminClient()
        .from('files')
        .select(`${FILE_COLUMNS}, received_from_recipient_id` as const)
        .eq('received_via_delivery_id', delivery.id)
        .eq('uploaded_by', delivery.owner_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(RECEIVED_LIMIT);
    if (error) throw error;
    const labels = new Map(recipients.map((r) => [r.id, recipientLabel(r)]));
    return (data ?? []).map((file) => ({
        ...serializeFile(file),
        from: file.received_from_recipient_id ? (labels.get(file.received_from_recipient_id) ?? null) : null,
    }));
}

/** Validate that every id is a live file of this owner. Returns the ids in order, or an error. */
export async function ownedFileIds(ownerId: string, fileIds: unknown): Promise<{ ids: string[] } | { error: string }> {
    if (!Array.isArray(fileIds)) return { error: 'Choose at least one file.' };
    const ids = [...new Set(fileIds.filter((id): id is string => typeof id === 'string'))];
    if (ids.length === 0) return { error: 'Choose at least one file.' };
    if (ids.length > 500) return { error: 'A delivery can have at most 500 files.' };
    const { data } = await createAdminClient()
        .from('files')
        .select('id')
        .eq('uploaded_by', ownerId)
        .is('deleted_at', null)
        .in('id', ids);
    const found = new Set((data ?? []).map((f) => f.id));
    if (found.size !== ids.length) return { error: "Some of those files don't exist anymore. Refresh and try again." };
    return { ids };
}

export async function replaceDeliveryFiles(deliveryId: string, fileIds: string[]): Promise<void> {
    const admin = createAdminClient();
    await admin.from('delivery_files').delete().eq('delivery_id', deliveryId);
    if (fileIds.length) {
        const { error } = await admin
            .from('delivery_files')
            .insert(fileIds.map((file_id, position) => ({ delivery_id: deliveryId, file_id, position })));
        if (error) throw error;
    }
}

export async function deliveryDetail(delivery: Delivery) {
    const admin = createAdminClient();
    const [files, { data: recipients }, { data: folder }] = await Promise.all([
        deliveryFiles(delivery.id),
        admin.from('delivery_recipients').select('*').eq('delivery_id', delivery.id).order('created_at', { ascending: true }),
        delivery.request_folder_id
            ? admin.from('folders').select('id, name').eq('id', delivery.request_folder_id).maybeSingle()
            : Promise.resolve({ data: null }),
    ]);
    const rows = recipients ?? [];
    const received = delivery.kind === 'request' ? await receivedFiles(delivery, rows) : [];
    return {
        ...serializeDeliverySummary(delivery),
        requestFolder: folder ? { id: folder.id, name: folder.name } : null,
        files,
        /** Requests: the files people uploaded (empty for deliveries) */
        received,
        recipients: rows.map(serializeRecipient),
        stats: {
            recipients: rows.filter((r) => !r.removed_at).length,
            opens: rows.reduce((sum, r) => sum + r.open_count, 0),
            downloads: rows.reduce((sum, r) => sum + r.download_count, 0),
            lastOpenedAt: rows.map((r) => r.last_opened_at).filter(Boolean).sort().pop() ?? null,
        },
    };
}

/** Email the invite to an email recipient. Returns whether it was sent. */
export async function sendInvite(
    delivery: Delivery,
    recipient: Recipient,
    sender: SenderIdentity,
    request?: Request,
): Promise<boolean> {
    if (recipient.kind !== 'person' || recipient.identifier_type !== 'email' || !recipient.identifier) return false;
    const files = delivery.kind === 'send' ? await deliveryFiles(delivery.id) : [];
    const email = inviteEmail({
        sender,
        kind: delivery.kind,
        title: delivery.title,
        message: delivery.message,
        fileNames: files.map((f) => f.name),
        url: deliveryUrl(delivery.short_code),
        method: recipient.method,
        recipientEmail: recipient.identifier,
        endsAt: recipient.ends_at,
        downloadLimit: recipient.download_limit,
    });
    const sent = await sendEmail({
        to: recipient.identifier,
        ...email,
        fromName: sender.name,
        replyTo: sender.email ?? undefined,
    });
    if (sent) {
        await recordActivity({
            ownerId: delivery.owner_id,
            type: 'invite_sent',
            deliveryId: delivery.id,
            recipientId: recipient.id,
            actor: recipient.identifier,
            request,
            notify: false,
        });
    }
    return sent;
}

export interface AddRecipientsInput {
    people?: RecipientInput[];
    anyone?: RecipientInput | null;
    sendInvites?: boolean;
}

/**
 * Add people (and optionally "Anyone with the password") to a delivery. All input is validated
 * before anything is written. Each person gets their own password; passwords are returned once.
 */
export async function addRecipients(
    delivery: Delivery,
    settings: OwnerSettings,
    sender: SenderIdentity,
    input: AddRecipientsInput,
    request?: Request,
): Promise<{ error: string } | { recipients: ReturnType<typeof recipientResult>[] }> {
    const admin = createAdminClient();
    const people = Array.isArray(input.people) ? input.people : [];
    if (people.length > 200) return { error: 'Add at most 200 people at a time.' };

    const parsed: ParsedRecipient[] = [];
    const seen = new Set<string>();
    for (const person of people) {
        const result = await parsePersonRecipient(person, settings);
        if ('error' in result) return { error: result.error };
        const identifier = result.value.row.identifier as string;
        if (seen.has(identifier)) continue;
        seen.add(identifier);
        parsed.push(result.value);
    }

    let anyone: ParsedRecipient | null = null;
    if (input.anyone) {
        const result = await parseAnyoneRecipient(input.anyone, settings);
        if ('error' in result) return { error: result.error };
        anyone = result.value;
    }
    if (parsed.length === 0 && !anyone) return { error: 'Add at least one person, or give access to anyone with the password.' };

    const { data: existing } = await admin
        .from('delivery_recipients')
        .select('identifier, kind')
        .eq('delivery_id', delivery.id)
        .is('removed_at', null);
    const taken = new Set((existing ?? []).map((r) => r.identifier).filter(Boolean));
    const duplicate = parsed.find((p) => taken.has(p.row.identifier as string));
    if (duplicate) return { error: `${duplicate.row.identifier} already has access to this delivery.` };
    if (anyone && (existing ?? []).some((r) => r.kind === 'anyone')) {
        return { error: 'Anyone with the password already has access. Change that password instead.' };
    }

    const all = anyone ? [...parsed, anyone] : parsed;
    const { data: inserted, error } = await admin
        .from('delivery_recipients')
        .insert(all.map((p) => ({ ...p.row, delivery_id: delivery.id })))
        .select('*');
    if (error || !inserted) throw error ?? new Error('Insert failed');

    const passwords = new Map(all.map((p) => [p.row.kind === 'anyone' ? '__anyone__' : (p.row.identifier as string), p.password]));
    const sendInvites = input.sendInvites !== false;

    const results = [];
    for (const recipient of inserted) {
        await recordActivity({
            ownerId: delivery.owner_id,
            type: 'access_given',
            deliveryId: delivery.id,
            recipientId: recipient.id,
            actor: recipient.identifier,
            request,
            notify: false,
        });
        const inviteSent = sendInvites ? await sendInvite(delivery, recipient, sender, request) : false;
        results.push(
            recipientResult(delivery, recipient, sender, {
                password: passwords.get(recipient.kind === 'anyone' ? '__anyone__' : (recipient.identifier as string)) ?? null,
                inviteSent,
            }),
        );
    }
    return { recipients: results };
}

/** Owner-facing result for a just-created or just-changed recipient: includes the password once. */
export function recipientResult(
    delivery: Delivery,
    recipient: Recipient,
    sender: Pick<SenderIdentity, 'name'>,
    extras: { password: string | null; inviteSent: boolean },
) {
    return {
        ...serializeRecipient(recipient),
        password: extras.password,
        inviteSent: extras.inviteSent,
        inviteText: inviteText({
            senderName: sender.name,
            title: delivery.title,
            kind: delivery.kind,
            link: deliveryUrl(delivery.short_code),
            recipient,
        }),
        label: recipientLabel(recipient),
    };
}
