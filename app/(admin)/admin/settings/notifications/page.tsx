import type { Metadata } from 'next';
import NotificationSettings from './NotificationSettings';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationSettingsPage() {
    return <NotificationSettings />;
}
