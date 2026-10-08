import type { Metadata } from 'next';
import { Composer } from '@/components/product/deliveries/Composer';

export const metadata: Metadata = { title: 'New delivery' };

/** /admin/deliveries/new?files=id1,id2 preselects files (e.g. "Send" from Files). */
export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<{ files?: string | string[] }> }) {
    const { files } = await searchParams;
    const raw = Array.isArray(files) ? files.join(',') : (files ?? '');
    const ids = raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
        .slice(0, 100);
    return <Composer kind="send" initialFileIds={ids} />;
}
