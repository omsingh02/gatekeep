import type { Metadata } from 'next';
import { Send } from 'lucide-react';
import { Breadcrumb, Card, EmptyState, PageHeader } from '@/components/ds';

export const metadata: Metadata = { title: 'New delivery' };

// Placeholder until the deliveries flow is built in v2: replace this file.
// The Files page links here with ?files=<id>,<id> for the files to send.
export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<{ files?: string }> }) {
    const { files } = await searchParams;
    const count = files ? files.split(',').filter(Boolean).length : 0;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                breadcrumb={<Breadcrumb items={[{ label: 'Deliveries', href: '/admin/deliveries' }, { label: 'New delivery' }]} />}
                title="New delivery"
                description="Pick files, add the people who should get them, and send one link."
            />
            <Card flush>
                <EmptyState
                    icon={Send}
                    title="Coming in v2"
                    description={
                        count > 0
                            ? `You picked ${count} ${count === 1 ? 'file' : 'files'}. Sending them in a delivery arrives with the next update.`
                            : 'Sending files in a delivery arrives with the next update.'
                    }
                />
            </Card>
        </div>
    );
}
