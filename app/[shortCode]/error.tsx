'use client';

import { RotateCw, WifiOff } from 'lucide-react';
import { AuthCard } from '@/components/account/AuthCard';
import { Button } from '@/components/ds';

/** A lookup failed (not a missing link): the link is probably fine, so offer a retry. */
export default function DeliveryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <AuthCard
            icon={WifiOff}
            title="We couldn't load this delivery"
            description="Something went wrong on our side. Your link is probably fine, so try again in a moment."
        >
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
