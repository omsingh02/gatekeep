import type { Metadata } from 'next';
import BrandingSettings from './BrandingSettings';

export const metadata: Metadata = { title: 'Branding' };

export default function BrandingSettingsPage() {
    return <BrandingSettings />;
}
