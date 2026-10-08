import type { Metadata } from 'next';
import AccountSettings from './AccountSettings';

export const metadata: Metadata = { title: 'Account' };

export default function AccountSettingsPage() {
    return <AccountSettings />;
}
