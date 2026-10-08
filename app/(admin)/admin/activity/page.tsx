import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ds';

export const metadata: Metadata = { title: 'Activity' };

// Placeholder until this section is built in v2: replace this file.
export default function ActivityPage() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Activity" description="Every open, download and denied attempt." />
            <Card flush>
                <EmptyState icon={History} title="Coming in v2" description="See who opened, downloaded or was denied, with the time and the reason." />
            </Card>
        </div>
    );
}
