import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Avatar, Card, LogoMark, cn } from '@/components/ds';
import type { PublicSender } from './api';
import { senderOrganization } from './format';

/** "Sent with Gatekeep": the only place recipients see the product name. */
export function GatekeepFooter({ className }: { className?: string }) {
    return (
        <p className={cn('flex items-center justify-center gap-1.5 text-caption text-tertiary', className)}>
            <LogoMark size={14} />
            Sent with Gatekeep
        </p>
    );
}

/** A centred 400px card on the canvas, nothing behind it (docs/DESIGN.md, recipient pages). */
export function CardPage({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
    return (
        <div className="flex min-h-dvh flex-col bg-canvas px-4 py-10 sm:py-16">
            <main className="m-auto flex w-full max-w-card flex-col gap-6">
                {children}
                {footer && <GatekeepFooter />}
            </main>
        </div>
    );
}

/** The sender's logo when they've set one, otherwise their initial. */
export function SenderAvatar({ sender, size = 'md' }: { sender: PublicSender; size?: 'sm' | 'md' }) {
    const box = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
    if (sender.logoUrl) {
        return (
            <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-default bg-raised', box)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the owner's logo from public storage; any host */}
                <img src={sender.logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
            </span>
        );
    }
    return <Avatar name={sender.name} className={cn(box, size === 'sm' ? 'text-caption' : 'text-body')} />;
}

/** Sender identity: logo + name, with the organization underneath. */
export function SenderBlock({ sender }: { sender: PublicSender }) {
    const organization = senderOrganization(sender);
    return (
        <div className="flex min-w-0 items-center gap-3">
            <SenderAvatar sender={sender} />
            <div className="min-w-0">
                <p className="truncate text-body font-medium text-strong">{sender.name}</p>
                {organization && <p className="truncate text-body-sm text-secondary">{organization}</p>}
            </div>
        </div>
    );
}

export interface StateCardProps {
    icon: LucideIcon;
    title: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
    sender?: PublicSender;
    tone?: 'neutral' | 'warning' | 'danger';
}

const toneClass = {
    neutral: 'border-default bg-raised text-secondary',
    warning: 'border-warning-border bg-warning-bg text-warning',
    danger: 'border-danger-border bg-danger-bg text-danger',
};

/** A dedicated, form-free layout for a state the recipient can't fix by retrying. */
export function StateCard({ icon: Icon, title, children, action, sender, tone = 'neutral' }: StateCardProps) {
    return (
        <CardPage>
            <Card className="flex flex-col gap-5 p-6 sm:p-6">
                {sender && (
                    <div className="border-b border-subtle pb-5">
                        <SenderBlock sender={sender} />
                    </div>
                )}
                <div className="flex flex-col gap-4">
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-md border', toneClass[tone])}>
                        <Icon aria-hidden strokeWidth={1.75} className="h-5 w-5" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-h2 text-strong">{title}</h1>
                        {children && <div className="text-body text-secondary">{children}</div>}
                    </div>
                </div>
                {action && <div className="flex flex-col gap-2">{action}</div>}
            </Card>
        </CardPage>
    );
}
