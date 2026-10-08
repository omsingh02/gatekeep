import type { Metadata } from 'next';

// The Shares page is a client component, so its title lives here
export const metadata: Metadata = { title: 'Shares' };

export default function SharesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
