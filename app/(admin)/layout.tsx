import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { getSignedIn, needsTwoFactorCode } from '@/lib/auth/twoFactor';
import { Logo } from '@/components/ds';
import AdminNav from '@/components/admin/AdminNav';
import AccountMenu from '@/components/admin/AccountMenu';

export const metadata: Metadata = {
    title: { default: 'Overview — Gatekeep', template: '%s — Gatekeep' },
    robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // Check authentication and redirect if not logged in
    const supabase = await createClient();
    const {
        data: { user, aal },
    } = await getSignedIn(supabase);

    if (!user) {
        redirect('/login');
    }
    // Signed in is not enough: only the owner may use the dashboard
    if (!isOwner(user)) {
        redirect('/login?reason=not-owner');
    }
    // With two-factor sign-in on, the password alone isn't enough (proxy.ts redirects first)
    if (needsTwoFactorCode(user, aal)) {
        redirect('/login?step=code');
    }

    const email = user.email || 'Owner';

    return (
            <div className="min-h-screen bg-canvas text-primary">
                <header className="border-b border-subtle bg-surface">
                    <div className="mx-auto flex h-12 max-w-app items-center justify-between gap-4 px-4 sm:h-14 sm:px-8">
                        <Link href="/admin" className="rounded-md focus-ring" aria-label="Gatekeep, go to Overview">
                            <Logo size={24} />
                        </Link>
                        <AccountMenu email={email} />
                    </div>
                    <div className="mx-auto max-w-app px-4 sm:px-8">
                        <AdminNav />
                    </div>
                </header>
                <main className="mx-auto max-w-app px-4 pb-16 pt-6 sm:px-8 sm:pt-8">{children}</main>
            </div>
    );
}
