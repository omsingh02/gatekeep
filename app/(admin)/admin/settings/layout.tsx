import type { Metadata } from 'next';
import SettingsShell from './SettingsShell';

export const metadata: Metadata = { title: { default: 'Settings', template: '%s · Settings — Gatekeep' } };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <SettingsShell>{children}</SettingsShell>;
}
