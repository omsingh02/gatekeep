import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, Logo } from '@/components/ds';

export interface AuthCardProps {
    title: ReactNode;
    description?: ReactNode;
    /** A status icon above the title (for "Check your email", "Link expired" and similar states) */
    icon?: LucideIcon;
    iconClassName?: string;
    children?: ReactNode;
    /** Link under the card, e.g. "Back to sign in" */
    footer?: ReactNode;
}

/** Owner sign-in screens: the mono logo and a centred 400px card on the canvas, nothing behind it. */
export function AuthCard({ title, description, icon: Icon, iconClassName, children, footer }: AuthCardProps) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
            <div className="w-full max-w-card">
                <Link href="/" aria-label="Gatekeep home" className="mx-auto flex w-fit rounded-md focus-ring">
                    <Logo size={30} />
                </Link>
                <Card className="mt-8 p-6 sm:p-8">
                    {Icon && (
                        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-default bg-raised">
                            <Icon aria-hidden strokeWidth={1.75} className={iconClassName ?? 'h-5 w-5 text-secondary'} />
                        </span>
                    )}
                    <h1 className="text-h2 text-strong">{title}</h1>
                    {description && <div className="mt-1.5 text-body-sm text-secondary">{description}</div>}
                    {children}
                </Card>
                {footer && <div className="mt-6 flex justify-center text-body-sm">{footer}</div>}
            </div>
        </main>
    );
}

export function AuthFooterLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="inline-flex items-center gap-1.5 rounded-sm text-secondary transition-colors hover:text-primary focus-ring">
            {children}
        </Link>
    );
}
