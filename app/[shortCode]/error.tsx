'use client';

import Link from 'next/link';
import { CloudOff, RotateCw } from 'lucide-react';

export default function ShareError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 text-center text-[var(--text)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <CloudOff className="h-7 w-7 text-[var(--warning)]" />
            </span>
            <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">We couldn&apos;t load this link</h1>
            <p className="mt-3 max-w-md text-[var(--text-secondary)]">
                The file service is temporarily unavailable. Your link is probably fine — please try again in a few
                minutes.
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
                >
                    <RotateCw className="h-4 w-4" />
                    Try again
                </button>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium hover:border-[var(--primary)]"
                >
                    Back to Gatekeep
                </Link>
            </div>
        </div>
    );
}
