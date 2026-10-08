import { cache } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeShortCode } from '@/lib/utils/sanitization';
import { SIGNED_OUT_NOTICE } from '@/components/recipient/api';
import { publicSender } from '@/lib/deliveries/recipient-api';
import { recipientFromSession, sessionCookieName } from '@/lib/deliveries/session';
import { getSender } from '@/lib/deliveries/settings';
import { RecipientApp, type InitialScreen } from '@/components/recipient/RecipientApp';

type Params = { params: Promise<{ shortCode: string }> };

/**
 * The delivery behind a link, or null when there isn't one. A failed lookup (database unreachable)
 * throws, so error.tsx offers a retry instead of a misleading 404.
 */
const findDelivery = cache(async (shortCode: string) => {
    // Reject anything the sanitizer would alter, so /ab-cd can't resolve to /abcd
    const code = sanitizeShortCode(shortCode);
    if (!code || code !== shortCode) return null;

    const admin = createAdminClient();
    // Next memoizes identical GET fetches during a render; a signal opts out, so the re-read after
    // converting a v1 link sees the new delivery instead of the first, empty answer
    const find = () =>
        admin.from('deliveries').select('*').eq('short_code', code).is('deleted_at', null).abortSignal(new AbortController().signal).maybeSingle();

    let { data: delivery, error } = await find();
    if (error) throw new Error(`Delivery lookup failed: ${error.message}`);

    if (!delivery) {
        // Maybe a v1 link made after the upgrade: convert it on first use (as loadDeliveryByCode does)
        const legacy = await admin
            .from('files')
            .select('id')
            .eq('short_code', code)
            .is('deleted_at', null)
            .abortSignal(new AbortController().signal)
            .maybeSingle();
        if (legacy.error) throw new Error(`Link lookup failed: ${legacy.error.message}`);
        if (!legacy.data) return null;
        const migrated = await admin.rpc('migrate_v1_to_v2');
        if (migrated.error) throw new Error(`Link conversion failed: ${migrated.error.message}`);
        ({ data: delivery, error } = await find());
        if (error) throw new Error(`Delivery lookup failed: ${error.message}`);
        if (!delivery) return null;
    }
    return { delivery, sender: await getSender(delivery.owner_id) };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { shortCode } = await params;
    const found = await findDelivery(shortCode).catch(() => null);
    const title = !found
        ? 'Gatekeep'
        : found.delivery.kind === 'request'
          ? `${found.sender.name} asked you for files`
          : `${found.sender.name} sent you files`;
    return { title, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function DeliveryPage({ params }: Params) {
    const { shortCode } = await params;
    const found = await findDelivery(shortCode);
    if (!found) notFound();
    const { delivery, sender } = found;

    const { data: recipients, error } = await createAdminClient()
        .from('delivery_recipients')
        .select('kind, method')
        .eq('delivery_id', delivery.id)
        .is('removed_at', null);
    if (error) throw new Error(`Recipient lookup failed: ${error.message}`);
    const rows = recipients ?? [];
    const access = {
        emailCode: rows.some((r) => r.kind === 'person' && r.method === 'email_code'),
        password: rows.some((r) => r.kind === 'person' && r.method === 'password'),
        anyone: rows.some((r) => r.kind === 'anyone'),
    };

    // A returning visitor: decide the first screen here so the page doesn't flash the sign-in form
    const token = (await cookies()).get(sessionCookieName(delivery.short_code))?.value ?? null;
    const session = await recipientFromSession(delivery.id, token);
    const initial: InitialScreen =
        session.status === 'ok' ? 'load' : session.status === 'removed' || session.status === 'ended' ? session.status : 'sign-in';

    return (
        <RecipientApp
            code={delivery.short_code}
            kind={delivery.kind}
            sender={publicSender(sender)}
            access={access}
            initial={initial}
            notice={session.status === 'expired' ? SIGNED_OUT_NOTICE : null}
        />
    );
}
