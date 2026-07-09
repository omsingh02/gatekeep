import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/admin/SignOutButton';

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

    // Fallback for user email (defensive programming)
    const userEmail = user?.email || 'User';
    const userInitial = userEmail.charAt(0).toUpperCase();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
            {/* Header */}
            <header style={{
                backgroundColor: '#1a1a1a',
                borderBottom: '1px solid #2a2a2a',
            }}>
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: '1rem clamp(1rem, 3vw, 2rem)',
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
                            <div style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: '#2563eb',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <svg style={{ width: '22px', height: '22px', color: 'white' }} fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                                </svg>
                            </div>
                            <div>
                                <h1 style={{
                                    fontSize: '1.125rem',
                                    fontWeight: 600,
                                    color: '#e0e0e0',
                                    margin: 0,
                                }}>File Share</h1>
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
                                backgroundColor: '#2a2a2a',
                                borderRadius: '6px',
                                border: '1px solid #3a3a3a',
                                minWidth: 0,
                                maxWidth: '200px',
                            }}>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    backgroundColor: '#2563eb',
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
