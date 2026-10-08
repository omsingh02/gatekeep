import type { Metadata } from 'next';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Card, Logo } from '@/components/ds';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';

export const metadata: Metadata = {
    title: 'Link not found — Gatekeep',
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <div className="flex min-h-dvh flex-col bg-canvas px-4 py-10 sm:py-16">
            <main className="m-auto flex w-full max-w-card flex-col items-center gap-6">
                <Link href="/" aria-label="Gatekeep home" className="rounded-md focus-ring">
                    <Logo size={28} />
                </Link>
                <Card className="flex w-full flex-col gap-4 p-6 sm:p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-default bg-raised text-secondary">
                        <FileQuestion aria-hidden strokeWidth={1.75} className="h-5 w-5" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-h2 text-strong">This link doesn&apos;t lead anywhere</h1>
                        <p className="text-body text-secondary">{RECIPIENT_MESSAGES.notFound}</p>
                    </div>
                    <p className="border-t border-subtle pt-4 text-body-sm text-secondary">
                        If it was a delivery, it may have been deleted. The person who sent it can send you a new link.
                    </p>
                </Card>
            </main>
        </div>
    );
}
