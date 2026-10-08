import type { Metadata } from 'next';
import { Inbox } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ds';

export const metadata: Metadata = { title: 'Requests' };

// Placeholder until this section is built in v2: replace this file.
export default function RequestsPage() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Requests" description="Links that let people upload files to you." />
            <Card flush>
                <EmptyState icon={Inbox} title="Coming in v2" description="Ask clients for files with a link. What they upload lands in a folder you choose." />
            </Card>
        </div>
    );
}
