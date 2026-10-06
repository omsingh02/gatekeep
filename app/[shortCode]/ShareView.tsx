'use client';

import { useState, useEffect, type ComponentProps } from 'react';
import { LoadingSpinner } from '@/components/ui';
import FilePreview from '@/components/public/FilePreview';

type AccessMode = 'user' | 'public';
type FileData = ComponentProps<typeof FilePreview>['fileData'];

export default function ShareView({ shortCode }: { shortCode: string }) {
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [accessMode, setAccessMode] = useState<AccessMode>('user');
    const [userIdentifier, setUserIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [isRevalidating, setIsRevalidating] = useState(true);
    const [cachedUserIdentifier, setCachedUserIdentifier] = useState('');
    const [isPublicSession, setIsPublicSession] = useState(false);

    // Real-time access monitoring via SSE
    useEffect(() => {
        // Skip SSE for public access (no userIdentifier to track)
        if (!isVerified || isPublicSession) return;
        if (!cachedUserIdentifier) return;

        const eventSource = new EventSource(
            `/api/access/stream?shortCode=${encodeURIComponent(shortCode)}&userIdentifier=${encodeURIComponent(cachedUserIdentifier)}`
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.revoked || data.expired) {
                    // Access revoked or expired - kick user out
                    // Cookie will be ignored by server on next request anyway
                    setIsVerified(false);
                    setFileData(null);
                    setError(data.revoked ? 'Access has been revoked' : 'Access has expired');
                    eventSource.close();
                }
            } catch {
                // Ignore heartbeat messages and non-JSON data
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [isVerified, cachedUserIdentifier, shortCode, isPublicSession]);

    useEffect(() => {
        const revalidateAccess = async () => {
            // Try to use existing httpOnly cookie (sent automatically with request)
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // Include cookies in request
                    body: JSON.stringify({
                        shortCode,
                        // No userIdentifier or password needed if cookie exists
                    }),
                });

                if (response.ok) {
                    const freshData = await response.json();
                    setFileData(freshData);
                    setIsVerified(true);
                } else {
                    // If the server returns a 400 validation error (e.g. "User identifier required" or
                    // "Password or session token required") it simply means there is no valid
                    // session cookie and the user should see the login form — do not show
                    // the validation message as an alert on initial load.
                    if (response.status === 400) {
                        const errorData = await response.json().catch(() => ({}));
                        const msg = errorData.error || '';

                        // Treat these messages as expected unauthenticated cases and do nothing
                        if (
                            msg === 'User identifier required' ||
                            msg === 'Password or session token required' ||
                            msg === 'Missing required fields' ||
                            msg === 'Invalid user identifier'
                        ) {
                            // Intentionally no-op: user will be shown the form
                        } else {
                            setError(msg || 'Access denied');
                        }
                    } else {
                        const errorData = await response.json().catch(() => ({}));
                        setError(errorData.error || 'Access denied');
                    }
                }
            } catch {
                // Silently handle revalidation/network errors (expected when access is revoked)
            }
            setIsRevalidating(false);
        };

        revalidateAccess();
    }, [shortCode]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsVerifying(true);

        try {
            const isPublic = accessMode === 'public';
            
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Cookie will be set by server
                body: JSON.stringify({
                    shortCode,
                    userIdentifier: isPublic ? undefined : userIdentifier,
                    password,
                    isPublic,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Verification failed');
            }

            // httpOnly cookie is automatically set by server
            // No need to store anything in sessionStorage
            setFileData(data);
            setIsVerified(true);
            setCachedUserIdentifier(isPublic ? '' : userIdentifier);
            setIsPublicSession(isPublic);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Failed to verify access');
        } finally {
            setIsVerifying(false);
        }
    };

    if (isRevalidating) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1a1a1a',
            }}>
                <LoadingSpinner />
            </div>
        );
    }

    if (isVerified && fileData) {
        return (
            <FilePreview 
                fileData={fileData} 
                shortCode={shortCode}
                userIdentifier={cachedUserIdentifier}
            />
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(0.75rem, 3vw, 1rem)',
            backgroundColor: '#1a1a1a',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '448px',
                padding: 'clamp(1.25rem, 4vw, 2rem)',
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                border: '1px solid #3a3a3a',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'clamp(1.25rem, 4vw, 2rem)' }}>
                    <div style={{
                        width: 'clamp(48px, 12vw, 64px)',
                        height: 'clamp(48px, 12vw, 64px)',
                        backgroundColor: '#3b82f6',
                        borderRadius: '6px',
                        margin: '0 auto 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg style={{ width: 'clamp(24px, 6vw, 32px)', height: 'clamp(24px, 6vw, 32px)', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 style={{
                        fontSize: 'clamp(1.25rem, 2.5vw + 0.5rem, 1.5rem)',
                        fontWeight: 600,
                        color: '#e0e0e0',
                        marginBottom: '0.25rem',
                        margin: '0 0 0.25rem 0',
                    }}>Secure File Access</h1>
                    <p style={{
                        fontSize: '0.875rem',
                        color: '#9ca3af',
                        margin: 0,
                    }}>Enter your credentials to access this file</p>
                </div>

                {/* Access Mode Toggle */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                }}>
                    <button
                        type="button"
                        onClick={() => {
                            setAccessMode('user');
                            setError('');
                        }}
                        style={{
                            flex: 1,
                            padding: '0.625rem',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: accessMode === 'user' ? '#ffffff' : '#9ca3af',
                            backgroundColor: accessMode === 'user' ? '#2563eb' : 'transparent',
                            border: `1px solid ${accessMode === 'user' ? '#3b82f6' : '#3a3a3a'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        User Access
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setAccessMode('public');
                            setError('');
                        }}
                        style={{
                            flex: 1,
                            padding: '0.625rem',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: accessMode === 'public' ? '#ffffff' : '#9ca3af',
                            backgroundColor: accessMode === 'public' ? '#059669' : 'transparent',
                            border: `1px solid ${accessMode === 'public' ? '#10b981' : '#3a3a3a'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        Public Link
                    </button>
                </div>

                <form onSubmit={handleVerify} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                }}>
                    {accessMode === 'user' && (
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                marginBottom: '0.5rem',
                            }}>Email or Username</label>
                            <input
                                value={userIdentifier}
                                onChange={(e) => setUserIdentifier(e.target.value)}
                                placeholder="your@email.com"
                                required={accessMode === 'user'}
                                autoComplete="username"
                                style={{
                                    width: '100%',
                                    padding: '0.625rem 0.875rem',
                                    borderRadius: '4px',
                                    border: '1px solid #3a3a3a',
                                    backgroundColor: '#1a1a1a',
                                    color: '#e0e0e0',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#3a3a3a'}
                            />
                        </div>
                    )}

                    {accessMode === 'public' && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            backgroundColor: '#064e3b',
                            border: '1px solid #10b981',
                        }}>
                            <p style={{ fontSize: '0.85rem', color: '#a7f3d0', margin: 0 }}>
                                This is a public link. Just enter the password to access.
                            </p>
                        </div>
                    )}

                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            color: '#9ca3af',
                            marginBottom: '0.5rem',
                        }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.875rem',
                                borderRadius: '4px',
                                border: '1px solid #3a3a3a',
                                backgroundColor: '#1a1a1a',
                                color: '#e0e0e0',
                                fontSize: '0.875rem',
                                outline: 'none',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#3a3a3a'}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            backgroundColor: '#7f1d1d',
                            border: '1px solid #ef4444',
                        }}>
                            <p style={{ fontSize: '0.875rem', color: '#fecaca', margin: 0 }}>{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isVerifying}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'white',
                            backgroundColor: accessMode === 'public' ? '#059669' : '#3b82f6',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isVerifying ? 'not-allowed' : 'pointer',
                            opacity: isVerifying ? 0.6 : 1,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            if (!isVerifying) e.currentTarget.style.backgroundColor = accessMode === 'public' ? '#047857' : '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                            if (!isVerifying) e.currentTarget.style.backgroundColor = accessMode === 'public' ? '#059669' : '#3b82f6';
                        }}
                    >
                        {isVerifying ? 'Verifying...' : 'Access File'}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <p style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        margin: 0,
                    }}>
                        This file is protected. Contact the file owner if you need access.
                    </p>
                </div>
            </div>
        </div>
    );
}
