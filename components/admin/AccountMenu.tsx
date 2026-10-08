'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { Avatar, Menu } from '@/components/ds';

const ICON = { 'aria-hidden': true, strokeWidth: 1.75, className: 'h-4 w-4' } as const;

/** The signed-in owner: avatar trigger with the email, Settings and Sign out. */
export default function AccountMenu({ email }: { email: string }) {
    const router = useRouter();
    const signOutForm = useRef<HTMLFormElement>(null);

    return (
        <>
            <Menu
                label={`Account: ${email}`}
                header={
                    <span className="flex flex-col">
                        <span className="text-caption text-tertiary">Signed in as</span>
                        <span className="block max-w-64 truncate text-primary">{email}</span>
                    </span>
                }
                trigger={
                    <>
                        <Avatar name={email} size="sm" />
                        <span className="sr-only">Account menu for </span>
                        <span className="sr-only sm:hidden">{email}</span>
                        <span className="hidden max-w-56 truncate text-body-sm text-primary sm:inline">{email}</span>
                        <ChevronDown {...ICON} className="-ml-0.5 hidden h-4 w-4 text-tertiary sm:block" />
                    </>
                }
                items={[
                    { label: 'Settings', icon: <Settings {...ICON} />, onSelect: () => router.push('/admin/settings') },
                    { type: 'separator' },
                    { label: 'Sign out', icon: <LogOut {...ICON} />, onSelect: () => signOutForm.current?.requestSubmit() },
                ]}
            />
            <form ref={signOutForm} action="/api/auth/signout" method="POST" hidden />
        </>
    );
}
