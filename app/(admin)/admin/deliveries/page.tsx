import type { Metadata } from 'next';
import { Send } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ds';

export const metadata: Metadata = { title: 'Deliveries' };

// Placeholder until this section is built in v2: replace this file.
export default function DeliveriesPage() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Deliveries" description="Files you've sent and who opened them." />
            <Card flush>
                <EmptyState icon={Send} title="Coming in v2" description="Send files to named people through one link, and see who opened them." />
            </Card>
        </div>
    );
}
