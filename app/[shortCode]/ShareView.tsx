'use client';

import { useState, useEffect, type ComponentProps } from 'react';
import Link from 'next/link';
import { Loader2, Lock } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
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
                    // Restore who this session belongs to so live revocation and downloads work
                    setCachedUserIdentifier(freshData.access?.userIdentifier ?? '');
                    setIsPublicSession(Boolean(freshData.access?.isPublic));
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
                        const msg = errorData.error || '';
                        // A stale cookie (session replaced on another device) just means "sign in again"
                        if (msg !== 'Access denied' && msg !== 'Invalid session') {
                            setError(msg || 'Access denied');
                        }
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
            <div className="flex min-h-screen items-center justify-center bg-[#07080c]">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-300" aria-label="Loading" />
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

    const inputClass =
        'mt-2 block h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[15px] text-white placeholder:text-zinc-600 transition focus:border-indigo-400/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-indigo-500/15';
    const tabClass = (active: boolean) =>
        `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            active ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-zinc-400 hover:text-zinc-200'
        }`;

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07080c] px-4 py-12 text-zinc-100">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_20%,transparent_100%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[18%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.28),transparent)]"
            />

            <div className="relative w-full max-w-sm">
                <Link href="/" className="mx-auto flex w-fit text-white" aria-label="Gatekeep home">
                    <Logo size={34} />
                </Link>

                <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d0f15]/80 p-7 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10">
                        <Lock className="h-5 w-5 text-indigo-300" />
                    </span>
                    <h1 className="mt-5 text-xl font-semibold tracking-tight text-white">This file is protected</h1>
                    <p className="mt-1.5 text-sm text-zinc-400">
                        Enter the details the owner shared with you to unlock it.
                    </p>

                    {/* Access mode */}
                    <div className="mt-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={accessMode === 'user'}
                            onClick={() => {
                                setAccessMode('user');
                                setError('');
                            }}
                            className={tabClass(accessMode === 'user')}
                        >
                            Recipient
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={accessMode === 'public'}
                            onClick={() => {
                                setAccessMode('public');
                                setError('');
                            }}
                            className={tabClass(accessMode === 'public')}
                        >
                            Public link
                        </button>
                    </div>

                    <form onSubmit={handleVerify} className="mt-5 space-y-5">
                        {accessMode === 'user' ? (
                            <div>
                                <label htmlFor="identifier" className="block text-sm font-medium text-zinc-300">
                                    Email or username
                                </label>
                                <input
                                    id="identifier"
                                    value={userIdentifier}
                                    onChange={(e) => setUserIdentifier(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="username"
                                    className={inputClass}
                                />
                            </div>
                        ) : (
                            <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200">
                                Anyone with this link and its password can open the file.
                            </p>
                        )}

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                className={inputClass}
                            />
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200"
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isVerifying}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-zinc-900 shadow-[0_8px_30px_-6px_rgba(99,102,241,0.6)] transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isVerifying ? 'Unlocking…' : 'Unlock file'}
                        </button>
                    </form>
                </div>

                <p className="mx-auto mt-6 max-w-xs text-center text-xs leading-relaxed text-zinc-500">
                    Need access? Ask the person who shared this link. Protected by{' '}
                    <Link href="/" className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline">
                        Gatekeep
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
