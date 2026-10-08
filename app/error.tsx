'use client';

import { CircleAlert, RotateCw } from 'lucide-react';
import { AuthCard } from '@/components/account/AuthCard';
import { Button } from '@/components/ds';

/** Any other page that failed to render: the same card as the sign-in pages, with a retry. */
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <AuthCard icon={CircleAlert} title="We couldn't load this page" description="Something went wrong on our side. Try again in a moment.">
            <Button
                variant="primary"
                size="lg"
                fullWidth
                className="mt-6"
                icon={<RotateCw aria-hidden strokeWidth={1.75} className="h-4 w-4" />}
                onClick={reset}
            >
                Try again
            </Button>
        </AuthCard>
    );
}
