import type { Metadata } from 'next';
import { FileQuestion } from 'lucide-react';
import { AuthCard } from '@/components/account/AuthCard';

export const metadata: Metadata = {
    title: 'Link not found — Gatekeep',
    robots: { index: false, follow: false },
};

/** Same logo-and-card layout as the sign-in and reset-link pages. */
export default function NotFound() {
    return (
        <AuthCard icon={FileQuestion} title="This link doesn't lead anywhere" description="Check you copied all of it, or ask the person who sent it.">
            <p className="mt-4 border-t border-subtle pt-4 text-body-sm text-secondary">
                If it was a delivery, it may have been deleted. The person who sent it can send you a new link.
            </p>
        </AuthCard>
    );
}
