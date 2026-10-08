'use client';

import { RotateCw, WifiOff } from 'lucide-react';
import { Button, Card, Logo } from '@/components/ds';

/** A lookup failed (not a missing link): the link is probably fine, so offer a retry. */
export default function DeliveryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="flex min-h-dvh flex-col bg-canvas px-4 py-10 sm:py-16">
            <main className="m-auto flex w-full max-w-card flex-col items-center gap-6">
                <Logo size={28} />
                <Card className="flex w-full flex-col gap-5 p-6 sm:p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-default bg-raised text-secondary">
                        <WifiOff aria-hidden strokeWidth={1.75} className="h-5 w-5" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-h2 text-strong">We couldn&apos;t load this delivery</h1>
                        <p className="text-body text-secondary">
                            Something went wrong on our side. Your link is probably fine, so try again in a moment.
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        icon={<RotateCw aria-hidden strokeWidth={1.75} className="h-4 w-4" />}
                        onClick={reset}
                    >
                        Try again
                    </Button>
                </Card>
            </main>
        </div>
    );
}
