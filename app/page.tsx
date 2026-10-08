import { cache } from 'react';
import type { Metadata } from 'next';
import BrandedHome from '@/components/marketing/BrandedHome';
import Landing from '@/components/marketing/Landing';
import { getInstanceHomepage } from '@/lib/deliveries/settings';

// The owner can switch the homepage at any time in Settings → Branding
export const dynamic = 'force-dynamic';

const loadHomepage = cache(getInstanceHomepage);

export async function generateMetadata(): Promise<Metadata> {
    const home = await loadHomepage();
    if (home.mode === 'landing') return {};
    const title = home.name ? `${home.name} · Secure file delivery` : 'Secure file delivery';
    const description = home.name
        ? `Files from ${home.name} are delivered securely through this site.`
        : 'Files are delivered securely through this site.';
    return {
        title,
        description,
        openGraph: { title, description },
        twitter: { title, description },
        robots: { index: false, follow: false },
    };
}

/** `/`: the product page, or the owner's branded welcome (owner_settings.homepage). */
export default async function Home() {
    const home = await loadHomepage();
    if (home.mode === 'branded') return <BrandedHome name={home.name} person={home.person} logoUrl={home.logoUrl} />;
    return <Landing />;
}
