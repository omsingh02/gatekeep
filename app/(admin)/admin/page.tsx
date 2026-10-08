import type { Metadata } from 'next';
import Overview from '@/components/admin/Overview';

export const metadata: Metadata = { title: 'Overview' };

export default function OverviewPage() {
    return <Overview />;
}
