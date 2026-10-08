import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import SignOutButton from '@/components/admin/SignOutButton';
import AdminNav from '@/components/admin/AdminNav';

export const metadata: Metadata = {
    title: { default: 'Overview — Gatekeep', template: '%s — Gatekeep' },
    robots: { index: false, follow: false },
};

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Check authentication and redirect if not logged in
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }
    // Signed in is not enough: only the owner may use the dashboard
    if (!isOwner(user)) {
        redirect('/login?reason=not-owner');
    }

    // Fallback for user email (defensive programming)
    const userEmail = user?.email || 'User';
    const userInitial = userEmail.charAt(0).toUpperCase();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#07080c' }}>
            {/* Header */}
            <header style={{
                backgroundColor: '#0b0c11',
                borderBottom: '1px solid #12141c',
            }}>
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: '1rem clamp(1rem, 3vw, 2rem) 0',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                    }}>
                        {/* Logo & Brand */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
                            <img
                                src="/brand/logo-mark.svg"
                                alt=""
                                aria-hidden="true"
                                width={38}
                                height={38}
                                style={{ width: '38px', height: '38px', display: 'block' }}
                            />
                            <div>
                                <h1 style={{
                                    fontSize: '1.125rem',
                                    fontWeight: 600,
                                    color: '#e0e0e0',
                                    margin: 0,
                                }}>Gatekeep</h1>
                                <p style={{
                                    fontSize: '0.7rem',
                                    color: '#6b7280',
                                    margin: 0,
                                    fontWeight: 500,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                }}>Admin Panel</p>
                            </div>
                        </div>

                        {/* User Section */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '0.5rem 0.75rem',
                                backgroundColor: '#12141c',
                                borderRadius: '6px',
                                border: '1px solid #23263a',
                                minWidth: 0,
                                maxWidth: '200px',
                            }}>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    backgroundColor: '#4f46e5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                    }}>
                                        {userInitial}
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '0.8125rem',
                                    color: '#e0e0e0',
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {userEmail}
                                </span>
                            </div>
                            <SignOutButton />
                        </div>
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                        <AdminNav />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: 'clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 3vw, 2rem)',
            }}>
                {children}
            </main>
        </div>
    );
}
