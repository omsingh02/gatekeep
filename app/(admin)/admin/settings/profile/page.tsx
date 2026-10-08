import type { Metadata } from 'next';
import ProfileSettings from './ProfileSettings';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfileSettingsPage() {
    return <ProfileSettings />;
}
