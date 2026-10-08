import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Choose a new password — Gatekeep',
    robots: { index: false, follow: false },
    // The page URL carries a one-time token: never send it to other sites
    referrer: 'no-referrer',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
    return children;
}
