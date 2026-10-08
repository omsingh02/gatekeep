import type { Metadata } from 'next';
import SharingSettings from './SharingSettings';

export const metadata: Metadata = { title: 'Sharing defaults' };

export default function SharingSettingsPage() {
    return <SharingSettings />;
}
