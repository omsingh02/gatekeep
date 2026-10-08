import type { Metadata } from 'next';
import { Settings } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ds';

export const metadata: Metadata = { title: 'Settings' };

// Placeholder until this section is built in v2: replace this file.
export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Settings" description="Your name, branding, sharing defaults and notifications." />
            <Card flush>
                <EmptyState icon={Settings} title="Coming in v2" description="Set the name recipients see, your sharing defaults and when to email you." />
            </Card>
        </div>
    );
}
