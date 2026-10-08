import Link from 'next/link';
import { Avatar, Card, LogoMark } from '@/components/ds';
import { REPO_URL } from './links';

export interface BrandedHomeProps {
    /** Organization, or the owner's display name when there's no organization */
    name: string | null;
    /** The owner's display name when `name` is the organization */
    person: string | null;
    logoUrl: string | null;
}

/**
 * `/` when the owner chose "Branded welcome": who this site belongs to, and where to go. Visitors
 * here are almost always recipients who typed the address, so it points them back to their link.
 */
export default function BrandedHome({ name, person, logoUrl }: BrandedHomeProps) {
    return (
        <div className="flex min-h-dvh flex-col bg-canvas px-4 py-10 sm:py-16">
            <main className="m-auto flex w-full max-w-card flex-col items-center gap-6">
                <Card className="flex w-full flex-col items-center p-6 text-center sm:p-8">
                    {logoUrl ? (
                        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-default bg-inset">
                            {/* The owner's logo from the public branding bucket: a plain <img>, no optimisation needed */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoUrl} alt="" className="h-full w-full object-contain p-1.5" />
                        </span>
                    ) : name ? (
                        <Avatar name={name} />
                    ) : (
                        <LogoMark size={40} />
                    )}
                    <h1 className="mt-4 text-h2 text-strong">{name ?? 'Secure file delivery'}</h1>
                    {person && <p className="text-body-sm text-secondary">{person}</p>}
                    <p className="mt-3 text-body text-secondary">
                        {name ? `Files from ${name} are delivered securely through this site.` : 'Files are delivered securely through this site.'}{' '}
                        Use the link you were sent.
                    </p>
                    <p className="mt-6 w-full border-t border-subtle pt-4 text-caption text-tertiary">
                        No link? Ask the person who sent you files for a new one.
                    </p>
                </Card>
                <Link href="/login" className="rounded-sm text-body-sm text-secondary underline-offset-4 hover:text-strong hover:underline">
                    Sign in to send files
                </Link>
            </main>
            <footer className="mt-10 flex justify-center">
                <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-sm text-caption text-tertiary hover:text-secondary"
                >
                    <LogoMark size={16} />
                    Powered by Gatekeep
                </a>
            </footer>
        </div>
    );
}
