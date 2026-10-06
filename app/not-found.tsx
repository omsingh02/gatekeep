import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Link not found — Gatekeep',
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 text-center text-[var(--text)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <FileQuestion className="h-7 w-7 text-[var(--primary)]" />
            </span>
            <p className="mt-6 text-sm font-medium text-[var(--text-muted)]">404</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">This link doesn&apos;t lead anywhere</h1>
            <p className="mt-3 max-w-md text-[var(--text-secondary)]">
                The file may have been deleted, or the link was copied incorrectly. Ask the person who shared it
                for a new link.
            </p>
            <Link
                href="/"
                className="mt-8 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium hover:border-[var(--primary)]"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Gatekeep
            </Link>
        </div>
    );
}
