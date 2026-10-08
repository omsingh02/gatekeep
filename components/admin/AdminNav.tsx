'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, FolderOpen, LayoutDashboard, Share2, type LucideIcon } from 'lucide-react';

const ITEMS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/admin/files', label: 'Files', icon: FolderOpen },
    { href: '/admin/access', label: 'Shares', icon: Share2 },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

/** Persistent section tabs for the dashboard; replaces per-page "Back to Admin" links. */
export default function AdminNav() {
    const pathname = usePathname();

    return (
        <nav aria-label="Dashboard sections" className="-mb-px flex gap-1 overflow-x-auto">
            {ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                            active
                                ? 'border-indigo-400 text-white'
                                : 'border-transparent text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                        }`}
                    >
                        <Icon className="h-4 w-4" aria-hidden />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
