'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ImageIcon, KeyRound, Server, SlidersHorizontal, UserRound } from 'lucide-react';
import { Button, Callout, Card, CardHeader, ConfirmDialog, PageHeader, Skeleton, TabNav } from '@/components/ds';
import { SettingsProvider, useSettings } from './SettingsContext';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

const SECTIONS = [
    { href: '/admin/settings/profile', label: 'Profile', icon: <UserRound {...ICON} /> },
    { href: '/admin/settings/branding', label: 'Branding', icon: <ImageIcon {...ICON} /> },
    { href: '/admin/settings/sharing', label: 'Sharing defaults', icon: <SlidersHorizontal {...ICON} /> },
    { href: '/admin/settings/notifications', label: 'Notifications', icon: <Bell {...ICON} /> },
    { href: '/admin/settings/account', label: 'Account', icon: <KeyRound {...ICON} /> },
    { href: '/admin/settings/status', label: 'System status', icon: <Server {...ICON} /> },
];

function Shell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isDirty, clearDirty } = useSettings();
    const [pending, setPending] = useState<string | null>(null);

    const items = SECTIONS.map((s) => ({ ...s, active: pathname === s.href || pathname.startsWith(`${s.href}/`) }));
    const onNavigate = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href === pathname || !isDirty()) return;
        event.preventDefault();
        setPending(href);
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Settings" description="How you appear to recipients, your defaults and how this Gatekeep is set up." />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                <TabNav
                    label="Settings sections"
                    items={items}
                    onNavigate={onNavigate}
                    className="-mx-1 border-b border-subtle px-1 lg:hidden"
                />
                <TabNav
                    label="Settings sections"
                    orientation="vertical"
                    items={items}
                    onNavigate={onNavigate}
                    className="hidden w-52 shrink-0 lg:sticky lg:top-6 lg:flex"
                />
                <div className="min-w-0 max-w-3xl flex-1">{children}</div>
            </div>
            <ConfirmDialog
                open={pending !== null}
                onClose={() => setPending(null)}
                onConfirm={() => {
                    const href = pending;
                    clearDirty();
                    setPending(null);
                    if (href) router.push(href);
                }}
                title="Discard unsaved changes?"
                confirmLabel="Discard changes"
                cancelLabel="Keep editing"
                destructive
            >
                You changed settings on this page without saving them. Leaving now discards those changes.
            </ConfirmDialog>
        </div>
    );
}

export default function SettingsShell({ children }: { children: ReactNode }) {
    return (
        <SettingsProvider>
            <Shell>{children}</Shell>
        </SettingsProvider>
    );
}

/** Shown while /api/settings loads, shaped like a section card. */
export function SectionSkeleton({ rows = 2 }: { rows?: number }) {
    return (
        <Card flush aria-busy="true" aria-label="Loading settings">
            <div className="border-b border-subtle px-4 py-3 sm:px-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-1.5 h-4 w-72 max-w-full" />
            </div>
            <div className="flex flex-col gap-5 px-4 py-5 sm:px-5">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ))}
            </div>
            <div className="flex justify-end border-t border-subtle px-4 py-3 sm:px-5">
                <Skeleton className="h-8 w-28" />
            </div>
        </Card>
    );
}

/** Loading, error, or the section once settings are in. */
export function WithSettings({ rows, children }: { rows?: number; children: (settings: NonNullable<ReturnType<typeof useSettings>['settings']>) => ReactNode }) {
    const { settings, loadError, reload } = useSettings();
    if (loadError && !settings) {
        return (
            <Callout
                tone="danger"
                title="We couldn't load your settings"
                action={
                    <Button size="sm" onClick={reload}>
                        Try again
                    </Button>
                }
            >
                {loadError}
            </Callout>
        );
    }
    if (!settings) return <SectionSkeleton rows={rows} />;
    return <>{children(settings)}</>;
}

export interface SettingsSectionProps {
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    /** Form sections get a footer with the save button */
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
    saveLabel?: string;
    saving?: boolean;
    dirty?: boolean;
    /** Extra footer content on the left (e.g. "Reset" links) */
    footerStart?: ReactNode;
    className?: string;
}

/** One settings card: title + description, the fields, and (for forms) Save with unsaved-change awareness. */
export function SettingsSection({ title, description, children, onSubmit, saveLabel, saving, dirty, footerStart, className }: SettingsSectionProps) {
    const body = (
        <>
            <CardHeader title={title} description={description} />
            <div className="flex flex-col gap-5 px-4 py-5 sm:px-5">{children}</div>
            {onSubmit && (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-subtle px-4 py-3 sm:px-5">
                    <span className="mr-auto text-caption text-tertiary" aria-live="polite">
                        {footerStart ?? (dirty ? 'Unsaved changes' : null)}
                    </span>
                    <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
                        {saveLabel ?? 'Save changes'}
                    </Button>
                </div>
            )}
        </>
    );
    return (
        <Card flush className={className}>
            {onSubmit ? (
                <form noValidate onSubmit={onSubmit}>
                    {body}
                </form>
            ) : (
                body
            )}
        </Card>
    );
}
