import type { Metadata } from 'next';
import Link from 'next/link';
import {
    ArrowRight,
    BarChart3,
    Eye,
    FolderTree,
    Github,
    KeyRound,
    Link2,
    Lock,
    MailCheck,
    ShieldCheck,
    Timer,
    Upload,
    UserCheck,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Gatekeep — Access-controlled file sharing',
    description:
        'Self-hosted file sharing with short links, per-email access, expiring grants, in-browser previews and full audit logs.',
};

const GITHUB_URL = 'https://github.com/omsingh02/file-share';

const features = [
    {
        icon: FolderTree,
        title: 'Files & folders',
        body: 'Upload straight to storage with presigned URLs and organise everything into nested folders.',
    },
    {
        icon: Link2,
        title: 'Short share links',
        body: 'Every file gets a compact short code like /aB3xY9 that is easy to send and impossible to guess.',
    },
    {
        icon: UserCheck,
        title: 'Per-email access',
        body: 'Grant access to specific people — one at a time or in bulk — and revoke it whenever you like.',
    },
    {
        icon: Timer,
        title: 'Expiring grants',
        body: 'Set access to lapse after an hour, a week or a custom date. Expired links stop working on their own.',
    },
    {
        icon: Eye,
        title: 'In-browser preview',
        body: 'Recipients view images, video, PDFs and Office documents without downloading anything first.',
    },
    {
        icon: BarChart3,
        title: 'Analytics & audit log',
        body: 'See who opened what and when, including denied attempts and the reason they were blocked.',
    },
];

const steps = [
    {
        icon: Upload,
        title: 'Upload',
        body: 'Drop files into the dashboard. They go directly to private Supabase Storage.',
    },
    {
        icon: KeyRound,
        title: 'Grant access',
        body: 'Add the email addresses that may open the file and choose when their access expires.',
    },
    {
        icon: MailCheck,
        title: 'Share & verify',
        body: 'Send the short link. Recipients confirm their email, then preview or download securely.',
    },
];

const security = [
    'Row-level security on every table',
    'httpOnly, signed access tokens',
    'Rate limiting on verification & downloads',
    'Strict Content Security Policy & HSTS',
    'Service-role key never leaves the server',
    'Input sanitisation on every route',
];

export default function Home() {
    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Link href="/" className="flex items-center" aria-label="Gatekeep home">
                        <picture>
                            <source
                                srcSet="/assets/logo-gatekeep-mascot-wordmark-dark.svg"
                                media="(prefers-color-scheme: dark)"
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/logo-gatekeep-mascot-wordmark-light.svg"
                                alt="Gatekeep"
                                className="h-8 w-auto"
                            />
                        </picture>
                    </Link>
                    <nav className="flex items-center gap-2 sm:gap-4 text-sm">
                        <a href="#how-it-works" className="hidden sm:inline text-[var(--text-secondary)] hover:text-[var(--text)]">
                            How it works
                        </a>
                        <a href="#security" className="hidden sm:inline text-[var(--text-secondary)] hover:text-[var(--text)]">
                            Security
                        </a>
                        <Link
                            href="/login"
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-medium hover:border-[var(--primary)]"
                        >
                            Sign in
                        </Link>
                    </nav>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="relative overflow-hidden">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,rgba(0,102,204,0.15),transparent_60%)]"
                    />
                    <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 text-center">
                        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                            <ShieldCheck className="h-3.5 w-3.5 text-[var(--primary)]" />
                            Self-hosted · Open source
                        </span>
                        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
                            Share files with exactly the people you choose.
                        </h1>
                        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)]">
                            Gatekeep turns your Supabase project into a private file-sharing service — short links,
                            per-email access, expiring grants, in-browser previews and a full audit trail.
                        </p>
                        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Link
                                href="/admin"
                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-6 py-3 font-medium text-white shadow-sm hover:bg-[var(--primary-hover)]"
                            >
                                Open dashboard
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <a
                                href="#how-it-works"
                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 font-medium hover:border-[var(--primary)]"
                            >
                                How it works
                            </a>
                        </div>

                        {/* Link preview mock */}
                        <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-lg">
                            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-sm">
                                <Lock className="h-4 w-4 text-[var(--success)]" />
                                <span className="text-[var(--text-secondary)]">dl.example.com/</span>
                                <span className="font-semibold text-[var(--primary)]">aB3xY9</span>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-sm">
                                <div>
                                    <p className="font-medium">Q3-report.pdf</p>
                                    <p className="text-[var(--text-secondary)]">Shared with 3 people · expires in 7 days</p>
                                </div>
                                <span className="rounded-full bg-[var(--success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--success)]">
                                    Verified
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="border-t border-[var(--border)] bg-[var(--surface)]">
                    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
                        <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need to share privately</h2>
                        <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--text-secondary)]">
                            Built for people who want Dropbox-style convenience without handing their files to someone else.
                        </p>
                        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {features.map(({ icon: Icon, title, body }) => (
                                <div
                                    key={title}
                                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 transition-colors hover:border-[var(--primary)]"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10">
                                        <Icon className="h-5 w-5 text-[var(--primary)]" />
                                    </div>
                                    <h3 className="mt-4 font-semibold">{title}</h3>
                                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section id="how-it-works" className="scroll-mt-16 border-t border-[var(--border)]">
                    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
                        <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
                        <ol className="mt-12 grid gap-8 md:grid-cols-3">
                            {steps.map(({ icon: Icon, title, body }, i) => (
                                <li key={title} className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                                    <span className="absolute -top-3 left-6 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-xs font-semibold text-white">
                                        Step {i + 1}
                                    </span>
                                    <Icon className="h-6 w-6 text-[var(--primary)]" />
                                    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{body}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* Security */}
                <section id="security" className="scroll-mt-16 border-t border-[var(--border)] bg-[var(--surface)]">
                    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
                        <div>
                            <ShieldCheck className="h-10 w-10 text-[var(--primary)]" />
                            <h2 className="mt-4 text-3xl font-bold tracking-tight">Secure by default</h2>
                            <p className="mt-4 text-[var(--text-secondary)]">
                                Files live in a private bucket and are only ever served through short-lived signed URLs
                                after the recipient&apos;s access has been checked on the server.
                            </p>
                        </div>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {security.map((item) => (
                                <li
                                    key={item}
                                    className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm"
                                >
                                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* CTA */}
                <section className="border-t border-[var(--border)]">
                    <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
                        <h2 className="text-3xl font-bold tracking-tight">Ready to take control of your files?</h2>
                        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Link
                                href="/admin"
                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-6 py-3 font-medium text-white hover:bg-[var(--primary-hover)]"
                            >
                                Open dashboard
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <a
                                href={GITHUB_URL}
                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 font-medium hover:border-[var(--primary)]"
                            >
                                <Github className="h-4 w-4" />
                                Self-host it
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-[var(--border)]">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-[var(--text-secondary)] sm:flex-row sm:px-6">
                    <p>© {new Date().getFullYear()} Gatekeep. Built with Next.js &amp; Supabase.</p>
                    <a href={GITHUB_URL} className="inline-flex items-center gap-2 hover:text-[var(--text)]">
                        <Github className="h-4 w-4" />
                        omsingh02/file-share
                    </a>
                </div>
            </footer>
        </div>
    );
}
