'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            router.push('/admin');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div 
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                background: '#2a2a2a',
                position: 'relative',
            }}
        >
            {/* Login Card */}
            <div style={{
                width: '100%',
                maxWidth: '560px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                padding: '3rem 2.5rem',
            }}>
                {/* Heading */}
                <h2 style={{ 
                    fontSize: '1.75rem',
                    textAlign: 'center',
                    marginBottom: '2rem',
                    color: '#6b7c93',
                    fontWeight: 500,
                    margin: '0 0 2rem 0',
                }}>
                    Login to your Account
                </h2>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Username Field */}
                    <div>
                        <label 
                            htmlFor="email" 
                            style={{ 
                                display: 'block',
                                fontSize: '0.9rem',
                                marginBottom: '0.5rem',
                                color: '#adb5bd',
                                fontWeight: 400,
                            }}
                        >
                            Username
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            style={{ 
                                width: '100%',
                                padding: '0.875rem 1rem',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: '#eff1f3',
                                color: '#2d3748',
                                fontSize: '1rem',
                                outline: 'none',
                                boxShadow: 'none',
                            }}
                            onFocus={(e) => {
                                e.target.style.outline = 'none';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Password Field */}
                    <div>
                        <label 
                            htmlFor="password" 
                            style={{ 
                                display: 'block',
                                fontSize: '0.9rem',
                                marginBottom: '0.5rem',
                                color: '#adb5bd',
                                fontWeight: 400,
                            }}
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            style={{ 
                                width: '100%',
                                padding: '0.875rem 1rem',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: '#eff1f3',
                                color: '#2d3748',
                                fontSize: '1rem',
                                outline: 'none',
                                boxShadow: 'none',
                            }}
                            onFocus={(e) => {
                                e.target.style.outline = 'none';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div style={{ 
                            padding: '0.75rem',
                            borderRadius: '4px',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fecaca',
                        }}>
                            <p style={{ 
                                fontSize: '0.875rem',
                                color: '#dc2626',
                                margin: 0,
                            }}>{error}</p>
                        </div>
                    )}

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{ 
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#334155',
                            color: 'white',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            marginTop: '0.5rem',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = '#475569';
                        }}
                        onMouseLeave={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = '#334155';
                        }}
                    >
                        {isLoading ? 'LOGGING IN...' : 'LOGIN'}
                    </button>
                </form>
            </div>
        </div>
    );
}
