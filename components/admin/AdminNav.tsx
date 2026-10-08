'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { TabNav } from '@/components/ds';

const ITEMS: { href: string; label: string; exact?: boolean }[] = [
    { href: '/admin', label: 'Overview', exact: true },
    { href: '/admin/files', label: 'Files' },
    { href: '/admin/deliveries', label: 'Deliveries' },
    { href: '/admin/requests', label: 'Requests' },
    { href: '/admin/activity', label: 'Activity' },
    { href: '/admin/settings', label: 'Settings' },
];

/** Dashboard sections. Scrolls sideways on small screens, with the current section kept in view. */
export default function AdminNav() {
    const pathname = usePathname();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const current = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
        current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [pathname]);

    return (
        <div
            ref={ref}
            // Fade the right edge on small screens to show the tabs scroll
            className="-mx-4 px-4 sm:mx-0 sm:px-0 [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] sm:[mask-image:none]"
        >
            <TabNav
                label="Dashboard sections"
                className="-mb-px pr-6 sm:pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                items={ITEMS.map(({ href, label, exact }) => ({
                    href,
                    label,
                    active: exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
                }))}
            />
        </div>
    );
}
