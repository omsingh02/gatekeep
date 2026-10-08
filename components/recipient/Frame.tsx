'use client';

import { useState, type ReactNode } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { Button, cn } from '@/components/ds';
import { recipientApi, type PublicSender } from './api';
import { endsLabel, endsSoon } from './format';
import { GatekeepFooter, SenderAvatar } from './Shell';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

/** The signed-in page: a quiet top bar with the sender and "Sign out", then a centred column. */
export function SignedInFrame({
    code,
    sender,
    onSignedOut,
    children,
}: {
    code: string;
    sender: PublicSender;
    onSignedOut: () => void;
    children: ReactNode;
}) {
    const [signingOut, setSigningOut] = useState(false);
    return (
        <div className="flex min-h-dvh flex-col bg-canvas">
            <div className="border-b border-subtle bg-surface">
                <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <SenderAvatar sender={sender} size="sm" />
                        <span className="truncate text-body-sm font-medium text-primary">{sender.label}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="lg"
                        className="-mr-3"
                        loading={signingOut}
                        icon={<LogOut {...ICON} />}
                        onClick={async () => {
                            setSigningOut(true);
                            await recipientApi.signOut(code);
                            setSigningOut(false);
                            onSignedOut();
                        }}
                    >
                        Sign out
                    </Button>
                </div>
            </div>
            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
            <GatekeepFooter className="px-4 pb-8" />
        </div>
    );
}

/** "Avery Stone sent you files" + title + the sender's message for this delivery. */
export function DeliveryHeading({ eyebrow, title, message, actions }: { eyebrow: string; title: string; message: string | null; actions?: ReactNode }) {
    return (
        <header className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-body-sm text-secondary">{eyebrow}</p>
                    <h1 className="break-words text-h1 text-strong">{title}</h1>
                </div>
                {actions && <div className="flex shrink-0 flex-col gap-2 sm:flex-row">{actions}</div>}
            </div>
            {message && <p className="max-w-2xl whitespace-pre-line border-l-2 border-default pl-3 text-body text-primary">{message}</p>}
        </header>
    );
}

/** Meta line: "Access ends Oct 14 · in 6 days", downloads left, and so on. */
export function MetaRow({ items }: { items: { icon: typeof Clock; text: ReactNode; tone?: 'warning' }[] }) {
    if (items.length === 0) return null;
    return (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-body-sm text-secondary">
            {items.map(({ icon: Icon, text, tone }, i) => (
                <li key={i} className={cn('flex items-center gap-1.5 tabular-nums', tone === 'warning' && 'text-warning')}>
                    <Icon {...ICON} className="h-4 w-4 shrink-0" />
                    {text}
                </li>
            ))}
        </ul>
    );
}

export function endsItem(endsAt: string | null) {
    if (!endsAt) return [];
    return [{ icon: Clock, text: `Access ends ${endsLabel(endsAt)}`, tone: endsSoon(endsAt) ? ('warning' as const) : undefined }];
}
