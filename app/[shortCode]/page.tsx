import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeShortCode } from '@/lib/utils/sanitization';
import ShareView from './ShareView';

export const metadata: Metadata = {
    title: 'Shared file — Gatekeep',
    robots: { index: false, follow: false },
};

export default async function ShortCodePage({ params }: { params: Promise<{ shortCode: string }> }) {
    const { shortCode } = await params;

    // Reject anything the sanitizer would alter, so /ab-cd can't resolve to /abcd
    const sanitized = sanitizeShortCode(shortCode);
    if (!sanitized || sanitized !== shortCode) notFound();

    const { data: file, error } = await createAdminClient()
        .from('files')
        .select('id')
        .eq('short_code', sanitized)
        .is('deleted_at', null)
        .maybeSingle();

    // A failed lookup (e.g. database unreachable) is not a missing file; let error.tsx handle it
    if (error) throw new Error(`Share lookup failed: ${error.message}`);
    if (!file) notFound();

    return <ShareView shortCode={sanitized} />;
}
