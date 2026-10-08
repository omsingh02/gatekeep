'use client';

import { useEffect, useId, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { IconButton } from '@/components/ds';

export interface NavLink {
    href: string;
    label: string;
    external?: boolean;
}

/** The section links on small screens: a menu button that drops a flat panel under the header. */
export function MobileNav({ links }: { links: NavLink[] }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <div className="md:hidden">
            <IconButton
                label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                aria-controls={panelId}
                icon={open ? <X aria-hidden strokeWidth={1.75} className="h-4 w-4" /> : <Menu aria-hidden strokeWidth={1.75} className="h-4 w-4" />}
                onClick={() => setOpen((value) => !value)}
            />
            {open && (
                <nav id={panelId} aria-label="Sections" className="absolute inset-x-0 top-full border-b border-subtle bg-canvas">
                    <ul className="flex flex-col px-4 py-2">
                        {links.map((link) => (
                            <li key={link.href}>
                                <a
                                    href={link.href}
                                    {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                                    onClick={() => setOpen(false)}
                                    className="flex h-11 items-center rounded-md px-2 text-body text-primary hover:bg-raised hover:text-strong"
                                >
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </div>
    );
}
