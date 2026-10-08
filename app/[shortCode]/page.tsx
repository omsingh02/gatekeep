import { cache } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeShortCode } from '@/lib/utils/sanitization';
import { loadDeliveryByCode } from '@/lib/deliveries/deliveries';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
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

    const { data, error } = await createAdminClient()
        .from('deliveries')
        .select('*')
        .eq('short_code', code)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error(`Delivery lookup failed: ${error.message}`);
    // Not found: maybe a v1 link made after the upgrade, which is converted on first use
    const delivery = data ?? (await loadDeliveryByCode(code));
    if (!delivery) return null;
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
            notice={session.status === 'expired' ? RECIPIENT_MESSAGES.sessionEnded : null}
        />
    );
}
