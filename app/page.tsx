import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    Activity,
    ArrowRight,
    BadgeCheck,
    Ban,
    Check,
    ChevronDown,
    CircleCheck,
    CircleX,
    Clock,
    Container,
    Database,
    Download,
    Eye,
    FileCode,
    FileText,
    FolderTree,
    Github,
    Globe,
    HeartPulse,
    KeyRound,
    Link2,
    Lock,
    Mail,
    Scale,
    ShieldCheck,
    Star,
    Timer,
    Triangle,
    Upload,
    Users,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { CopyCommand } from '@/components/brand/CopyCommand';

export const metadata: Metadata = {
    title: 'Gatekeep — Share files with exactly the people you choose',
    description:
        'Open-source, self-hosted file sharing. Short links, a password per recipient, expiry and download limits, in-browser previews and a full audit log. Next.js + Supabase, MIT licensed.',
};

const GITHUB_URL = 'https://github.com/omsingh02/gatekeep';
const DOCS_URL = `${GITHUB_URL}/blob/main/docs/DEPLOYMENT.md`;
const DEPLOY_URL =
    'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fomsingh02%2Fgatekeep&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_APP_URL,CRON_SECRET&envLink=https%3A%2F%2Fgithub.com%2Fomsingh02%2Fgatekeep%2Fblob%2Fmain%2Fdocs%2FDEPLOYMENT.md&project-name=gatekeep&repository-name=gatekeep';

const SCREENSHOT = { width: 2880, height: 1800 };

/* ---------------------------------------------------------------- */
/* Building blocks                                                   */
/* ---------------------------------------------------------------- */

function BrowserFrame({ url, children, className = '' }: { url: string; children: ReactNode; className?: string }) {
    return (
        <div
            className={`overflow-hidden rounded-xl border border-white/10 bg-[#0c0e14] shadow-2xl shadow-black/60 ring-1 ring-white/[0.04] ${className}`}
        >
            <div className="flex h-9 items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-3.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <div className="mx-auto flex h-6 w-full max-w-[16rem] items-center justify-center gap-1.5 rounded-md bg-white/[0.04] px-3 text-[11px] text-zinc-500">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span className="truncate">{url}</span>
                </div>
                <span className="w-9" />
            </div>
            {children}
        </div>
    );
}

function Screenshot({ src, alt, priority = false, sizes }: { src: string; alt: string; priority?: boolean; sizes: string }) {
    return (
        <Image
            src={src}
            alt={alt}
            width={SCREENSHOT.width}
            height={SCREENSHOT.height}
            priority={priority}
            sizes={sizes}
            className="block h-auto w-full"
        />
    );
}

function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <p className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-sm font-medium tracking-wide text-transparent">
            {children}
        </p>
    );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: ReactNode }) {
    return (
        <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">{title}</h2>
            {body && <p className="mt-4 text-pretty text-base text-zinc-400 sm:text-lg">{body}</p>}
        </div>
    );
}

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-white/[0.01] p-6 transition-colors hover:border-white/[0.14] ${className}`}
        >
            {children}
        </div>
    );
}

function CardTitle({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
    return (
        <div>
            <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-400/10 ring-1 ring-inset ring-indigo-300/20">
                    <Icon className="h-4 w-4 text-indigo-200" />
                </span>
                <h3 className="text-[15px] font-semibold text-white">{title}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
        </div>
    );
}

function StepNumber({ n }: { n: string }) {
    return (
        <span className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 font-mono text-xs text-zinc-400">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300" />
            Step {n}
        </span>
    );
}

function Code({ children }: { children: ReactNode }) {
    return (
        <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-zinc-200 ring-1 ring-inset ring-white/[0.08]">
            {children}
        </code>
    );
}

/** Floating "shared file" card in the hero */
function ShareCard({ className = '' }: { className?: string }) {
    return (
        <div
            className={`rounded-2xl border border-white/10 bg-[#0e1017]/90 p-4 text-left shadow-2xl shadow-black/70 backdrop-blur-xl ${className}`}
        >
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500/25 to-orange-400/20 ring-1 ring-inset ring-white/10">
                    <FileText className="h-5 w-5 text-rose-200" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">Q3-board-report.pdf</p>
                    <p className="text-xs text-zinc-500">4.2 MB · PDF</p>
                </div>
                <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Unlocked
                </span>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-xs text-zinc-300 ring-1 ring-inset ring-white/[0.06]">
                <Link2 className="h-3.5 w-3.5 text-indigo-300" />
                dl.example.com/<span className="text-cyan-300">aB3xY9</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-inset ring-white/[0.05]">
                    <dt className="flex items-center gap-1 text-zinc-500">
                        <Clock className="h-3 w-3" /> Expires
                    </dt>
                    <dd className="mt-0.5 font-medium text-zinc-200">in 7 days</dd>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-inset ring-white/[0.05]">
                    <dt className="flex items-center gap-1 text-zinc-500">
                        <Download className="h-3 w-3" /> Downloads
                    </dt>
                    <dd className="mt-0.5 font-medium text-zinc-200">2 of 5</dd>
                    <div className="mt-1.5 h-1 rounded-full bg-white/10">
                        <div className="h-1 w-2/5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300" />
                    </div>
                </div>
            </dl>
            <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-xs text-zinc-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[10px] font-semibold text-white">
                    M
                </span>
                maya@acme.co
                <span className="ml-auto inline-flex items-center gap-1 text-zinc-500">
                    <KeyRound className="h-3 w-3" /> own password
                </span>
            </div>
        </div>
    );
}

/** CSS-only illustration of the upload dropzone */
function UploadIllustration() {
    const files = [
        { name: 'contract-final.pdf', size: '1.8 MB', pct: 100, code: 'k9Tq2W' },
        { name: 'site-photos.zip', size: '86 MB', pct: 64, code: null },
        { name: 'launch-video.mp4', size: '42 MB', pct: 22, code: null },
    ];
    return (
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 px-6 py-9 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-400/10 ring-1 ring-inset ring-indigo-300/25">
                    <Upload className="h-5 w-5 text-indigo-200" />
                </span>
                <p className="mt-3 text-sm font-medium text-white">Drop files or folders</p>
                <p className="mt-1 text-xs text-zinc-500">Up to 100 MB each · straight to your bucket</p>
            </div>
            <ul className="mt-4 space-y-2">
                {files.map((f) => (
                    <li key={f.name} className="rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-inset ring-white/[0.06]">
                        <div className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                            <span className="truncate text-zinc-200">{f.name}</span>
                            <span className="ml-auto shrink-0 text-xs text-zinc-500">{f.size}</span>
                        </div>
                        {f.code ? (
                            <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-emerald-300/90">
                                <Check className="h-3 w-3" /> dl.example.com/{f.code}
                            </p>
                        ) : (
                            <div className="mt-2.5 h-1 rounded-full bg-white/10">
                                <div
                                    className="h-1 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300"
                                    style={{ width: `${f.pct}%` }}
                                />
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ---------------------------------------------------------------- */
/* Content                                                           */
/* ---------------------------------------------------------------- */

const stack = [
    { icon: Triangle, label: 'Next.js 16' },
    { icon: Database, label: 'Supabase' },
    { icon: ShieldCheck, label: 'Postgres RLS' },
    { icon: Globe, label: 'Vercel' },
    { icon: Container, label: 'Docker' },
    { icon: FileCode, label: 'TypeScript' },
];

const recipients = [
    { initial: 'M', who: 'maya@acme.co', kind: 'Email', meta: 'Expires in 7 days', tone: 'from-violet-400 to-fuchsia-400' },
    { initial: 'J', who: 'j.chen', kind: 'Username', meta: '2 of 5 downloads', tone: 'from-sky-400 to-cyan-300' },
    { initial: '*', who: 'Anyone with the link', kind: 'Public', meta: 'Password only', tone: 'from-amber-300 to-orange-400' },
];

const fileTypes = ['pdf', 'png', 'jpg', 'mp4', 'mp3', 'docx', 'xlsx', 'pptx', 'ts', 'json', 'md', 'csv'];

const auditRows = [
    { ok: true, who: 'maya@acme.co', what: 'unlocked', when: '2m ago' },
    { ok: false, who: '203.0.113.7', what: 'wrong_password', when: '9m ago' },
    { ok: false, who: 'j.chen', what: 'expired', when: '1h ago' },
    { ok: true, who: 'public', what: 'unlocked', when: '3h ago' },
];

const securityPoints = [
    {
        title: 'Row-level security on every table',
        body: 'Postgres policies scope every row to its owner. The service-role key never reaches the browser.',
    },
    {
        title: 'Passwords are bcrypt-hashed',
        body: 'Recipient passwords are never stored or returned in plain text — not even to you.',
    },
    {
        title: 'Hashed, httpOnly sessions',
        body: 'Unlocking issues a random token, stored hashed and sent as an httpOnly, SameSite=Strict cookie.',
    },
    {
        title: 'Brute-force throttling',
        body: '20 failed attempts per IP and 100 per file every 15 minutes, counted in the database so the limit holds across serverless instances.',
    },
    {
        title: 'Short-lived signed URLs',
        body: 'Files sit in a private bucket and only leave it through signed URLs issued after the grant is re-checked.',
    },
    {
        title: 'Strict headers',
        body: 'Content-Security-Policy, HSTS, frame denial and a locked-down permissions policy on every response.',
    },
];

const faqs = [
    {
        q: 'Do recipients need an account?',
        a: 'No. You add a recipient by email or username and give them a password — or create a public, password-only link. They open the short link, enter it, and that’s it.',
    },
    {
        q: 'Where are my files stored?',
        a: 'In a private Storage bucket in your own Supabase project. Uploads go straight to the bucket with presigned URLs and downloads use short-lived signed URLs. One thing to know: Office documents (Word, Excel, PowerPoint) are previewed with Microsoft’s online viewer, which fetches the file through a signed link.',
    },
    {
        q: 'Can I take access away after sharing?',
        a: 'Yes. Revoke a grant and it stops working immediately — a named recipient who has the file open is signed out in real time. Grants can also expire on a date or after a number of downloads.',
    },
    {
        q: 'What does it cost to run?',
        a: 'Gatekeep is MIT-licensed and free, and it runs on Supabase’s and Vercel’s free tiers. A daily keep-alive job stops a free Supabase project from pausing. Check your Supabase plan’s storage and upload-size limits — Gatekeep accepts files up to 100 MB.',
    },
    {
        q: 'Can I use my own domain?',
        a: 'Yes. Set NEXT_PUBLIC_APP_URL to your domain and every share link is generated on it, e.g. files.yourcompany.com/aB3xY9.',
    },
    {
        q: 'How do I know it’s working?',
        a: 'Point any uptime monitor at /api/health — it returns 200 when the app can reach the database and 503 when it can’t. Every unlock attempt, granted or denied, is in the audit log with its reason.',
    },
];

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function Home() {
    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#07080c] text-zinc-100 antialiased selection:bg-indigo-500/30">
            {/* Ambient background */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[1200px] bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,#000_30%,transparent_100%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[-340px] h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.32),transparent)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute right-[-200px] top-[380px] h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.14),transparent)]"
            />

            {/* Nav */}
            <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07080c]/70 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
                    <Link href="/" aria-label="Gatekeep home" className="text-white">
                        <Logo size={28} />
                    </Link>
                    <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
                        <a href="#features" className="transition hover:text-white">Features</a>
                        <a href="#how-it-works" className="transition hover:text-white">How it works</a>
                        <a href="#security" className="transition hover:text-white">Security</a>
                        <a href="#self-host" className="transition hover:text-white">Self-host</a>
                    </nav>
                    <div className="flex items-center gap-1.5">
                        <a
                            href={GITHUB_URL}
                            aria-label="Gatekeep on GitHub"
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition hover:text-white"
                        >
                            <Github className="h-4 w-4" />
                            <span className="hidden sm:inline">GitHub</span>
                        </a>
                        <Link
                            href="/login"
                            className="rounded-lg bg-white/[0.06] px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative">
                {/* Hero */}
                <section className="relative">
                    <div className="mx-auto max-w-6xl px-5 pb-14 pt-16 text-center sm:px-8 sm:pt-24">
                        <a
                            href={`${GITHUB_URL}/releases`}
                            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 text-xs text-zinc-300 transition hover:border-white/20"
                        >
                            <span className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-0.5 font-semibold text-white">
                                v1.0
                            </span>
                            Open source · MIT · Self-hosted
                            <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                        </a>

                        <h1 className="mx-auto mt-7 max-w-4xl text-balance text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white sm:text-6xl lg:text-[4.6rem]">
                            Share files with{' '}
                            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-cyan-200 bg-clip-text text-transparent">
                                exactly the people you choose.
                            </span>
                        </h1>

                        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
                            Gatekeep is open-source file sharing you run yourself. Every recipient gets their own
                            password, links expire on your schedule, and every unlock attempt is on the record.
                        </p>

                        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <a
                                href={DEPLOY_URL}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-900 shadow-[0_8px_32px_-4px_rgba(99,102,241,0.55)] transition hover:bg-zinc-200 sm:w-auto"
                            >
                                <Triangle className="h-3.5 w-3.5 fill-current" />
                                Deploy your own
                            </a>
                            <a
                                href={GITHUB_URL}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.08] sm:w-auto"
                            >
                                <Star className="h-4 w-4" />
                                Star on GitHub
                            </a>
                        </div>
                        <div className="mt-5 flex justify-center">
                            <CopyCommand command="docker compose up -d" />
                        </div>
                    </div>

                    {/* Product shot */}
                    <div className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28">
                        <div
                            aria-hidden
                            className="absolute inset-x-12 bottom-24 top-8 rounded-[2.5rem] bg-gradient-to-r from-indigo-500/35 via-sky-500/20 to-cyan-400/30 blur-3xl"
                        />
                        <BrowserFrame url="dl.example.com/admin" className="relative">
                            <Screenshot
                                src="/screenshots/dashboard.png"
                                alt="Gatekeep dashboard listing uploaded files, folders and their share links"
                                priority
                                sizes="(min-width: 1152px) 1088px, 100vw"
                            />
                        </BrowserFrame>
                        <ShareCard className="gk-float relative mx-auto mt-5 w-full max-w-[22rem] sm:absolute sm:bottom-6 sm:left-0 sm:mt-0 sm:w-[21rem] lg:-left-6" />
                    </div>
                </section>

                {/* Built on */}
                <section className="border-y border-white/[0.06] bg-white/[0.012]">
                    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-9 gap-y-3 px-5 py-6 text-sm text-zinc-500 sm:px-8">
                        <span className="w-full text-center text-[11px] uppercase tracking-[0.22em] text-zinc-600 sm:w-auto">
                            Built on
                        </span>
                        {stack.map(({ icon: Icon, label }) => (
                            <span key={label} className="inline-flex items-center gap-2">
                                <Icon className="h-4 w-4 text-zinc-600" />
                                {label}
                            </span>
                        ))}
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading
                            eyebrow="Features"
                            title="Everything a private link should have."
                            body="Public links leak and shared drives want everyone to sign up. Gatekeep sits in between: you own the storage, and every person gets their own key."
                        />

                        <div className="mt-16 grid gap-4 md:grid-cols-6">
                            <Card className="md:col-span-4">
                                <CardTitle
                                    icon={Users}
                                    title="A password for every recipient"
                                    body="Grant access by email or username — one at a time or a whole list in bulk — or create a public link that only needs a password."
                                />
                                <ul className="mt-6 space-y-2">
                                    {recipients.map((r) => (
                                        <li
                                            key={r.who}
                                            className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]"
                                        >
                                            <span
                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${r.tone} text-xs font-semibold text-white`}
                                            >
                                                {r.initial}
                                            </span>
                                            <span className="min-w-0 truncate text-sm text-zinc-200">{r.who}</span>
                                            <span className="hidden rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-400 sm:inline">
                                                {r.kind}
                                            </span>
                                            <span className="ml-auto shrink-0 text-xs text-zinc-500">{r.meta}</span>
                                            <KeyRound className="hidden h-3.5 w-3.5 shrink-0 text-indigo-300/70 sm:block" />
                                        </li>
                                    ))}
                                </ul>
                            </Card>

                            <Card className="md:col-span-2">
                                <CardTitle
                                    icon={Link2}
                                    title="Links you can read aloud"
                                    body="Every file gets a six-character code on your own domain."
                                />
                                <div className="mt-6 flex flex-col items-center justify-center rounded-xl bg-black/30 py-7 ring-1 ring-inset ring-white/[0.06]">
                                    <p className="font-mono text-sm text-zinc-500">dl.example.com/</p>
                                    <p className="mt-1 bg-gradient-to-r from-indigo-200 to-cyan-200 bg-clip-text font-mono text-4xl font-semibold tracking-tight text-transparent">
                                        aB3xY9
                                    </p>
                                    <p className="mt-3 text-[11px] text-zinc-600">56.8 billion possible codes</p>
                                </div>
                            </Card>

                            <Card className="md:col-span-2">
                                <CardTitle
                                    icon={Timer}
                                    title="Expiry & download limits"
                                    body="Let access lapse after an hour, a week or a date you pick, and cap how many downloads a grant gets."
                                />
                                <div className="mt-6 flex items-center gap-5 rounded-xl bg-black/30 p-4 ring-1 ring-inset ring-white/[0.06]">
                                    <svg viewBox="0 0 36 36" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
                                        <defs>
                                            <linearGradient id="gk-ring" x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0" stopColor="#818cf8" />
                                                <stop offset="1" stopColor="#67e8f9" />
                                            </linearGradient>
                                        </defs>
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                                        <circle
                                            cx="18"
                                            cy="18"
                                            r="15"
                                            fill="none"
                                            stroke="url(#gk-ring)"
                                            strokeWidth="3.5"
                                            strokeLinecap="round"
                                            strokeDasharray="94.25"
                                            strokeDashoffset="56.55"
                                        />
                                    </svg>
                                    <div className="text-sm">
                                        <p className="font-semibold text-white">2 of 5 downloads</p>
                                        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                                            <Clock className="h-3 w-3" /> Expires in 6 days
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="md:col-span-2">
                                <CardTitle
                                    icon={Ban}
                                    title="Revoke in real time"
                                    body="Remove a grant and a recipient who has the file open is signed out on the spot."
                                />
                                <div className="mt-6 flex items-center gap-2 rounded-xl bg-black/30 px-3 py-3 text-xs ring-1 ring-inset ring-white/[0.06]">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60 motion-reduce:hidden" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                                    </span>
                                    <span className="text-zinc-300">j.chen</span>
                                    <span className="ml-auto rounded-md bg-rose-400/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-inset ring-rose-400/20">
                                        Access revoked
                                    </span>
                                </div>
                                <p className="mt-2 px-1 text-[11px] text-zinc-600">Their open session ends immediately</p>
                            </Card>

                            <Card className="md:col-span-2">
                                <CardTitle
                                    icon={Eye}
                                    title="Preview without downloading"
                                    body="Images, video, audio, PDFs, code and Office documents open right in the browser."
                                />
                                <div className="mt-6 flex flex-wrap gap-1.5">
                                    {fileTypes.map((t) => (
                                        <span
                                            key={t}
                                            className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-zinc-400 ring-1 ring-inset ring-white/[0.07]"
                                        >
                                            .{t}
                                        </span>
                                    ))}
                                </div>
                            </Card>

                            <Card className="md:col-span-3">
                                <CardTitle
                                    icon={Activity}
                                    title="An audit log with reasons"
                                    body="Every unlock attempt — granted or denied — is recorded with its reason, IP and time. Analytics rank your most-opened files; download counts sit on each grant."
                                />
                                <div className="mt-6 overflow-hidden rounded-xl bg-black/40 font-mono text-[12px] ring-1 ring-inset ring-white/[0.06]">
                                    {auditRows.map((row) => (
                                        <div
                                            key={`${row.who}-${row.what}`}
                                            className="flex items-center gap-2.5 border-b border-white/[0.04] px-3.5 py-2 last:border-0"
                                        >
                                            {row.ok ? (
                                                <CircleCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                            ) : (
                                                <CircleX className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                                            )}
                                            <span className="truncate text-zinc-300">{row.who}</span>
                                            <span className={row.ok ? 'text-emerald-300/80' : 'text-rose-300/80'}>{row.what}</span>
                                            <span className="ml-auto shrink-0 text-zinc-600">{row.when}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card className="md:col-span-3">
                                <CardTitle
                                    icon={FolderTree}
                                    title="Folders, bulk grants & email"
                                    body="Organise uploads into nested folders, grant a whole list at once, and optionally email people when they’re given access (via Resend)."
                                />
                                <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-xl bg-black/30 p-3 ring-1 ring-inset ring-white/[0.06]">
                                        <p className="flex items-center gap-1.5 text-zinc-300">
                                            <FolderTree className="h-3.5 w-3.5 text-indigo-300" /> Clients
                                        </p>
                                        <p className="mt-1.5 pl-5 font-mono text-zinc-500">└ Acme</p>
                                        <p className="pl-9 font-mono text-zinc-500">└ Contracts</p>
                                    </div>
                                    <div className="rounded-xl bg-black/30 p-3 ring-1 ring-inset ring-white/[0.06]">
                                        <p className="flex items-center gap-1.5 text-zinc-300">
                                            <Mail className="h-3.5 w-3.5 text-cyan-300" /> Access granted
                                        </p>
                                        <p className="mt-1.5 text-zinc-500">“You can now open Q3-board-report.pdf”</p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section id="how-it-works" className="scroll-mt-20 border-t border-white/[0.06] px-5 py-24 sm:px-8 sm:py-32">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading eyebrow="How it works" title="From upload to unlocked in three steps." />

                        <div className="mt-20 space-y-24">
                            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                                <div>
                                    <StepNumber n="01" />
                                    <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                                        Upload straight to your bucket
                                    </h3>
                                    <p className="mt-4 text-zinc-400">
                                        Drag in files or whole folders. The browser uploads directly to your private Supabase
                                        Storage with presigned URLs, and each file gets its short link immediately.
                                    </p>
                                </div>
                                <UploadIllustration />
                            </div>

                            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                                <div className="lg:order-2">
                                    <StepNumber n="02" />
                                    <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                                        Decide who gets in
                                    </h3>
                                    <p className="mt-4 text-zinc-400">
                                        Add recipients with their own password, set an expiry and a download cap, or create a
                                        password-only public link. Change or revoke any of it later.
                                    </p>
                                </div>
                                <BrowserFrame url="dl.example.com/admin/access" className="lg:order-1">
                                    <Screenshot
                                        src="/screenshots/access.png"
                                        alt="Access manager listing recipients with their expiry and download limits"
                                        sizes="(min-width: 1024px) 560px, 100vw"
                                    />
                                </BrowserFrame>
                            </div>

                            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                                <div>
                                    <StepNumber n="03" />
                                    <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                                        Send the link. They unlock it.
                                    </h3>
                                    <p className="mt-4 text-zinc-400">
                                        Recipients open the short link, enter their password and preview or download — no
                                        account, no app. Their session lasts 24 hours and ends the moment you revoke it.
                                    </p>
                                </div>
                                <div className="relative pb-12 sm:pb-20">
                                    <BrowserFrame url="dl.example.com/aB3xY9" className="relative w-[86%]">
                                        <Screenshot
                                            src="/screenshots/share-unlock.png"
                                            alt="Share page asking the recipient for their email and password"
                                            sizes="(min-width: 1024px) 480px, 86vw"
                                        />
                                    </BrowserFrame>
                                    <BrowserFrame url="dl.example.com/aB3xY9" className="absolute bottom-0 right-0 w-[70%] shadow-black/80">
                                        <Screenshot
                                            src="/screenshots/share-preview.png"
                                            alt="Unlocked share page previewing the file in the browser"
                                            sizes="(min-width: 1024px) 390px, 70vw"
                                        />
                                    </BrowserFrame>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Security */}
                <section
                    id="security"
                    className="scroll-mt-20 border-t border-white/[0.06] bg-white/[0.012] px-5 py-24 sm:px-8 sm:py-32"
                >
                    <div className="mx-auto grid max-w-6xl items-start gap-14 lg:grid-cols-[1fr_1.15fr]">
                        <div>
                            <Eyebrow>Security</Eyebrow>
                            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
                                Locked down by default.
                            </h2>
                            <p className="mt-4 text-zinc-400">
                                No setting to forget. Every grant is re-checked on the server before a single byte leaves
                                storage.
                            </p>
                            <ul className="mt-10 space-y-6">
                                {securityPoints.map((p) => (
                                    <li key={p.title} className="flex gap-3.5">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/25">
                                            <Check className="h-3 w-3 text-emerald-300" />
                                        </span>
                                        <div>
                                            <p className="font-medium text-white">{p.title}</p>
                                            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{p.body}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="lg:sticky lg:top-28">
                            <BrowserFrame url="dl.example.com/admin">
                                <Screenshot
                                    src="/screenshots/analytics.png"
                                    alt="Analytics dashboard with views, downloads and the access log including denied attempts"
                                    sizes="(min-width: 1024px) 600px, 100vw"
                                />
                            </BrowserFrame>
                            <p className="mt-4 flex items-start gap-2 text-sm text-zinc-500">
                                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                                Denied attempts are logged with their reason — wrong password, expired, limit reached.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Self-host */}
                <section id="self-host" className="scroll-mt-20 border-t border-white/[0.06] px-5 py-24 sm:px-8 sm:py-32">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading
                            eyebrow="Self-host"
                            title="Your server. Your bucket. Your rules."
                            body="Bring a free Supabase project and run Gatekeep on Vercel or any machine with Docker. Setup takes about ten minutes."
                        />

                        <div className="mt-16 grid gap-4 lg:grid-cols-2">
                            <Card className="flex flex-col p-7">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-900">
                                        <Triangle className="h-4 w-4 fill-current" />
                                    </span>
                                    <div>
                                        <h3 className="font-semibold text-white">Vercel</h3>
                                        <p className="text-sm text-zinc-500">Recommended · one click</p>
                                    </div>
                                </div>
                                <ol className="mt-6 space-y-3 text-sm text-zinc-300">
                                    {[
                                        <>Create a free Supabase project</>,
                                        <>Apply the schema with <Code>npx supabase db push</Code></>,
                                        <>Click deploy and paste your keys</>,
                                        <>Create your login with <Code>npm run create-admin</Code></>,
                                    ].map((step, i) => (
                                        <li key={i} className="flex gap-3">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-medium text-zinc-400 ring-1 ring-inset ring-white/10">
                                                {i + 1}
                                            </span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                                <div className="mt-auto pt-8">
                                    <a
                                        href={DEPLOY_URL}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
                                    >
                                        <Triangle className="h-3.5 w-3.5 fill-current" />
                                        Deploy with Vercel
                                    </a>
                                </div>
                            </Card>

                            <Card className="flex flex-col p-7">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-inset ring-sky-400/30">
                                        <Container className="h-5 w-5 text-sky-300" />
                                    </span>
                                    <div>
                                        <h3 className="font-semibold text-white">Docker</h3>
                                        <p className="text-sm text-zinc-500">Any server · keep-alive sidecar included</p>
                                    </div>
                                </div>
                                <pre className="mt-6 overflow-x-auto rounded-xl bg-black/50 p-4 font-mono text-[12.5px] leading-6 text-zinc-300 ring-1 ring-inset ring-white/[0.07]">
                                    <code>
                                        <span className="text-zinc-600">$ </span>git clone {GITHUB_URL}
                                        {'\n'}
                                        <span className="text-zinc-600">$ </span>cd gatekeep && cp .env.example .env
                                        {'\n'}
                                        <span className="text-zinc-600">$ </span>docker compose up -d --build
                                        {'\n'}
                                        <span className="text-emerald-400/80">✓ gatekeep is running on :3000</span>
                                    </code>
                                </pre>
                                <div className="mt-auto pt-8">
                                    <a
                                        href={`${GITHUB_URL}/blob/main/docs/DOCKER.md`}
                                        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
                                    >
                                        Read the Docker guide <ArrowRight className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            </Card>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            {[
                                { icon: HeartPulse, title: 'Health endpoint', body: '/api/health for your uptime monitor.' },
                                { icon: Clock, title: 'Stays awake', body: 'A daily job keeps free Supabase projects from pausing.' },
                                { icon: Scale, title: 'MIT licensed', body: 'Use it, fork it, ship it — commercially too.' },
                            ].map(({ icon: Icon, title, body }) => (
                                <div
                                    key={title}
                                    className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
                                >
                                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                                    <div>
                                        <p className="text-sm font-medium text-white">{title}</p>
                                        <p className="mt-1 text-sm text-zinc-500">{body}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] px-5 py-24 sm:px-8 sm:py-32">
                    <div className="mx-auto max-w-3xl">
                        <SectionHeading eyebrow="FAQ" title="Questions, answered." />
                        <div className="mt-12 divide-y divide-white/[0.07] border-y border-white/[0.07]">
                            {faqs.map((f) => (
                                <details key={f.q} className="group py-5">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left font-medium text-white">
                                        {f.q}
                                        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
                                    </summary>
                                    <p className="mt-3 pr-10 text-sm leading-relaxed text-zinc-400">{f.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="px-5 pb-24 sm:px-8 sm:pb-32">
                    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/[0.18] via-[#0c0e14] to-cyan-400/[0.12] px-6 py-16 text-center sm:px-12 sm:py-20">
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,#000,transparent)]"
                        />
                        <div className="relative">
                            <div className="flex justify-center">
                                <Logo size={48} wordmark={false} />
                            </div>
                            <h2 className="mx-auto mt-6 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
                                Own your file sharing.
                            </h2>
                            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
                                Free, open source and yours to run. Deploy in minutes — or read the code first.
                            </p>
                            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                <a
                                    href={DEPLOY_URL}
                                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
                                >
                                    <Triangle className="h-3.5 w-3.5 fill-current" />
                                    Deploy your own
                                </a>
                                <a
                                    href={DOCS_URL}
                                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                                >
                                    Read the docs <ArrowRight className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/[0.06]">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 text-sm text-zinc-500 sm:flex-row sm:px-8">
                    <div className="flex items-center gap-4">
                        <span className="text-zinc-300">
                            <Logo size={22} />
                        </span>
                        <span>© 2026 Om Singh</span>
                    </div>
                    <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                        <a href={`${GITHUB_URL}/blob/main/LICENSE`} className="transition hover:text-zinc-300">
                            MIT License
                        </a>
                        <a href={GITHUB_URL} className="inline-flex items-center gap-1.5 transition hover:text-zinc-300">
                            <Github className="h-3.5 w-3.5" /> GitHub
                        </a>
                        <a href={DOCS_URL} className="transition hover:text-zinc-300">
                            Docs
                        </a>
                        <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} className="transition hover:text-zinc-300">
                            Security
                        </a>
                        <Link href="/login" className="transition hover:text-zinc-300">
                            Sign in
                        </Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
}
