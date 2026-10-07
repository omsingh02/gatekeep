'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/brand/Logo';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

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
        } catch (err) {
            setError((err instanceof Error && err.message) || 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07080c] px-4 py-12 text-zinc-100">
            {/* Ambient background */}
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
                    <h1 className="text-xl font-semibold tracking-tight text-white">Sign in to Gatekeep</h1>
                    <p className="mt-1.5 text-sm text-zinc-400">Use the admin account for this instance.</p>

                    <form onSubmit={handleLogin} className="mt-7 space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                className="mt-2 block h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[15px] text-white placeholder:text-zinc-600 transition focus:border-indigo-400/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-indigo-500/15"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="mt-2 block h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[15px] text-white placeholder:text-zinc-600 transition focus:border-indigo-400/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-indigo-500/15"
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
                            disabled={isLoading}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-zinc-900 shadow-[0_8px_30px_-6px_rgba(99,102,241,0.6)] transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isLoading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                </div>

                <Link
                    href="/"
                    className="mx-auto mt-6 flex w-fit items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to home
                </Link>
            </div>
        </div>
    );
}
