'use client';

import Link from 'next/link';
import { CloudOff, RotateCw } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

export default function ShareError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07080c] px-4 text-center text-zinc-100">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[22%] h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.14),transparent)]"
            />
            <Link href="/" className="absolute left-1/2 top-8 -translate-x-1/2 text-white" aria-label="Gatekeep home">
                <Logo size={28} />
            </Link>

            <div className="relative">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <CloudOff className="h-7 w-7 text-amber-300" />
                </span>
                <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    We couldn&apos;t load this link
                </h1>
                <p className="mx-auto mt-3 max-w-md text-zinc-400">
                    The file service is temporarily unavailable. Your link is probably fine — please try again in a few
                    minutes.
                </p>
                <div className="mt-8 flex justify-center gap-3">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
                    >
                        <RotateCw className="h-4 w-4" />
                        Try again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                    >
                        Back to Gatekeep
                    </Link>
                </div>
            </div>
        </div>
    );
}
