import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

export const metadata: Metadata = {
    title: 'Link not found — Gatekeep',
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07080c] px-4 text-center text-zinc-100">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[22%] h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.22),transparent)]"
            />
            <Link href="/" className="absolute left-1/2 top-8 -translate-x-1/2 text-white" aria-label="Gatekeep home">
                <Logo size={28} />
            </Link>

            <div className="relative">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <FileQuestion className="h-7 w-7 text-indigo-300" />
                </span>
                <p className="mt-6 font-mono text-sm text-zinc-500">404</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    This link doesn&apos;t lead anywhere
                </h1>
                <p className="mx-auto mt-3 max-w-md text-zinc-400">
                    The file may have been deleted, or the link was copied incorrectly. Ask the person who shared it
                    for a new link.
                </p>
                <Link
                    href="/"
                    className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Gatekeep
                </Link>
            </div>
        </div>
    );
}
