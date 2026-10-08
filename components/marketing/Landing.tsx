import type { ReactNode } from 'react';
import type { StaticImageData } from 'next/image';
import Link from 'next/link';
import {
    Activity,
    ArrowUpRight,
    BadgeCheck,
    Bell,
    Briefcase,
    Check,
    Database,
    Eye,
    EyeOff,
    FileArchive,
    Files,
    Gauge,
    Inbox,
    KeyRound,
    LockKeyhole,
    Mail,
    MailCheck,
    Minus,
    Palette,
    Plus,
    ReceiptText,
    Scale,
    ShieldCheck,
    Timer,
    Undo2,
    UserCheck,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { Badge, CopyField, Logo, LogoMark, buttonStyles, cn } from '@/components/ds';
import { GitHubIcon } from '@/components/brand/GitHubIcon';
import { AccessHelper } from './AccessHelper';
import { MobileNav, type NavLink } from './MobileNav';
import { Screenshot } from './Screenshot';
import activityShot from '@/public/screenshots/activity.png';
import deliveryShot from '@/public/screenshots/delivery.png';
import newDeliveryShot from '@/public/screenshots/new-delivery.png';
import signInShot from '@/public/screenshots/recipient-sign-in.png';
import {
    ACCESS_METHODS_URL,
    DEPLOY_URL,
    DEPLOYMENT_URL,
    DOCKER_URL,
    DOCS_URL,
    LICENSE_URL,
    REPO_URL,
    SECURITY_URL,
} from './links';

const ICON = { strokeWidth: 1.75, 'aria-hidden': true } as const;
const EXTERNAL = { target: '_blank', rel: 'noreferrer' } as const;
const DEMO_HOST = 'files.northwind.example';

const NAV: NavLink[] = [
    { href: '#product', label: 'Product' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#security', label: 'Security' },
    { href: '#self-host', label: 'Self-host' },
    { href: '#faq', label: 'FAQ' },
];

const SETUP_COMMANDS = [
    'git clone https://github.com/omsingh02/gatekeep.git',
    'cd gatekeep && npm install',
    'cp .env.example .env.local',
    'npx supabase link --project-ref <your-project-ref>',
    'npx supabase db push',
    'npm run create-admin',
].join('\n');

const DOCKER_COMMAND = ['cp .env.example .env', 'docker compose up -d --build'].join('\n');

/* ------------------------------------------------------------------ building blocks */

function Container({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cn('mx-auto w-full max-w-marketing px-4 sm:px-8', className)}>{children}</div>;
}

function Section({
    id,
    className,
    children,
    labelledBy,
    divider = true,
}: {
    id?: string;
    className?: string;
    children: ReactNode;
    labelledBy?: string;
    /** 1px border above the section (off when the section above already ends with one) */
    divider?: boolean;
}) {
    return (
        <section
            id={id}
            aria-labelledby={labelledBy}
            className={cn('scroll-mt-14 py-16 md:py-24', divider && 'border-t border-subtle', className)}
        >
            <Container>{children}</Container>
        </section>
    );
}

function SectionIntro({ id, eyebrow, title, children, className }: { id: string; eyebrow: string; title: ReactNode; children?: ReactNode; className?: string }) {
    return (
        <div className={cn('max-w-2xl', className)}>
            <p className="text-body-sm font-medium text-secondary">{eyebrow}</p>
            <h2 id={id} className="mt-2 text-h1 tracking-[-0.01em] text-strong md:text-[28px] md:leading-9">
                {title}
            </h2>
            {children && <p className="mt-3 text-h3 font-normal text-secondary">{children}</p>}
        </div>
    );
}

function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
    return (
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-default bg-raised text-primary', className)}>
            <Icon {...ICON} className="h-4 w-4" />
        </span>
    );
}

function TextLink({ href, children, external = true }: { href: string; children: ReactNode; external?: boolean }) {
    return (
        <a
            href={href}
            {...(external ? EXTERNAL : {})}
            className="inline-flex items-center gap-1 rounded-sm text-body font-medium text-primary underline-offset-4 hover:text-strong hover:underline"
        >
            {children}
            {external && <ArrowUpRight {...ICON} className="h-3.5 w-3.5" />}
        </a>
    );
}

/* ------------------------------------------------------------------ header and hero */

function Header() {
    return (
        <header className="sticky top-0 z-40 border-b border-subtle bg-canvas">
            <Container className="relative flex h-14 items-center gap-6">
                <Link href="/" aria-label="Gatekeep home" className="rounded-md">
                    <Logo size={26} />
                </Link>
                <nav aria-label="Sections" className="hidden md:block">
                    <ul className="flex items-center gap-1">
                        {NAV.map((item) => (
                            <li key={item.href}>
                                <a href={item.href} className="rounded-md px-2.5 py-1.5 text-body text-secondary transition-colors hover:bg-raised hover:text-strong">
                                    {item.label}
                                </a>
                            </li>
                        ))}
                        <li>
                            <a
                                href={REPO_URL}
                                {...EXTERNAL}
                                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-body text-secondary transition-colors hover:bg-raised hover:text-strong"
                            >
                                <GitHubIcon className="h-4 w-4" />
                                GitHub
                            </a>
                        </li>
                    </ul>
                </nav>
                <div className="ml-auto flex items-center gap-2">
                    <Link href="/login" className={buttonStyles({ variant: 'secondary' })}>
                        Sign in
                    </Link>
                    <MobileNav links={[...NAV, { href: REPO_URL, label: 'GitHub', external: true }]} />
                </div>
            </Container>
        </header>
    );
}

function Hero() {
    return (
        <section aria-labelledby="hero-title" className="pb-16 pt-14 md:pb-24 md:pt-24">
            <Container>
                <div className="max-w-3xl">
                    <Badge>Open source · Self-hosted · MIT license</Badge>
                    <h1 id="hero-title" className="mt-5 text-[32px]/9 font-semibold tracking-[-0.02em] text-strong md:text-display">
                        Secure file delivery with receipts.
                        <span className="block text-secondary">Send it. See who opened it. Take it back.</span>
                    </h1>
                    <p className="mt-5 max-w-2xl text-h2 font-normal text-secondary">
                        For agencies, consultants and legal, finance and HR teams who send files that matter to clients, and need to know they
                        reached the right person.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <a href={DEPLOY_URL} {...EXTERNAL} className={buttonStyles({ variant: 'primary', size: 'lg' })}>
                            Deploy your own
                            <ArrowUpRight {...ICON} className="h-4 w-4" />
                        </a>
                        <a href={REPO_URL} {...EXTERNAL} className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
                            <GitHubIcon className="h-4 w-4" />
                            View on GitHub
                        </a>
                    </div>
                    <p className="mt-4 text-body-sm text-tertiary">Free to run on your own Supabase, with Vercel or Docker.</p>
                </div>
                <Screenshot
                    priority
                    className="mt-12 md:mt-16"
                    image={deliveryShot}
                    address={`${DEMO_HOST}/admin/deliveries`}
                    alt="A delivery in Gatekeep: its files, the people it was sent to, when each of them opened it, and their downloads."
                />
            </Container>
        </section>
    );
}

const AUDIENCES: { icon: LucideIcon; title: string; detail: string }[] = [
    { icon: Palette, title: 'Agencies and studios', detail: 'Designs, footage and campaign assets' },
    { icon: Briefcase, title: 'Consultants and freelancers', detail: 'Reports, proposals and contracts' },
    { icon: Scale, title: 'Legal and finance', detail: 'Statements, agreements and case files' },
    { icon: Users, title: 'HR and people teams', detail: 'Offer letters, payroll and personnel files' },
];

function BuiltFor() {
    return (
        <section aria-labelledby="built-for" className="border-y border-subtle bg-surface">
            <Container className="py-10">
                <h2 id="built-for" className="text-body-sm font-medium text-secondary">
                    Built for people who send files that matter
                </h2>
                <ul className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {AUDIENCES.map(({ icon, title, detail }) => (
                        <li key={title} className="flex items-start gap-3">
                            <IconTile icon={icon} className="bg-canvas" />
                            <div>
                                <p className="text-body font-medium text-strong">{title}</p>
                                <p className="text-body-sm text-tertiary">{detail}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </Container>
        </section>
    );
}

/* ------------------------------------------------------------------ product */

const PILLARS: { icon: LucideIcon; title: string; body: string }[] = [
    {
        icon: UserCheck,
        title: 'Each person has their own access',
        body: 'Recipients prove who they are with a one-time code sent to their email, or with their own password. Remove one person without affecting anyone else.',
    },
    {
        icon: ReceiptText,
        title: 'Receipts, not guesses',
        body: 'Every open, preview, download and denied attempt is recorded with the person, time, IP address and reason. You get an email when it matters.',
    },
    {
        icon: Undo2,
        title: 'Control after sending',
        body: 'Set an end date and a download limit, or remove access at any time. If the page is open when you do, it closes on the spot.',
    },
];

const COMPARISON: { label: string; link: string; gatekeep: string }[] = [
    { label: 'Who can open it', link: 'Anyone who has the URL, and maybe one shared password', gatekeep: 'Only the people you add, each with their own code or password' },
    { label: 'What you learn', link: 'A download count, if anything', gatekeep: 'Who opened it, previewed it, downloaded it or was denied, and when' },
    { label: 'After you send it', link: 'Delete the file and hope', gatekeep: 'End dates, download limits and removal that takes effect immediately' },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Files, title: 'Many files, one link', body: 'Group files into a delivery with a title and a message.' },
    { icon: FileArchive, title: 'Download all', body: 'Recipients take everything as one zip, built in their browser.' },
    { icon: Eye, title: 'Preview in the browser', body: 'Images, video, audio, PDFs and text open without a download.' },
    { icon: Inbox, title: 'Requests', body: 'Ask clients for files. Uploads land in the folder you choose.' },
    { icon: Activity, title: 'Activity and CSV export', body: 'Filter by delivery, event and period, then export the record.' },
    { icon: Bell, title: 'Notifications', body: 'An email when someone opens, downloads, uploads or is denied.' },
    { icon: BadgeCheck, title: 'Your name on it', body: 'Your name, organization, logo and message on every delivery page.' },
    { icon: KeyRound, title: 'Anyone with the password', body: "For a group you can't name, protected by one password." },
];

function Product() {
    return (
        <Section id="product" labelledBy="product-title" divider={false}>
            <SectionIntro id="product-title" eyebrow="Why Gatekeep" title="Named recipients, not bearer links.">
                Most file links work for anyone who holds the URL, and tell you nothing afterwards. Gatekeep gives every person their own access,
                keeps a receipt for everything that happens, and lets you take it back.
            </SectionIntro>

            <ul className="mt-10 grid gap-4 md:grid-cols-3">
                {PILLARS.map(({ icon, title, body }) => (
                    <li key={title} className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-5">
                        <IconTile icon={icon} />
                        <div>
                            <h3 className="text-h3 text-strong">{title}</h3>
                            <p className="mt-1.5 text-body text-secondary">{body}</p>
                        </div>
                    </li>
                ))}
            </ul>

            <div className="mt-4 overflow-hidden rounded-lg border border-default">
                <table className="w-full border-collapse text-left">
                    <caption className="sr-only">A typical file link compared with a Gatekeep delivery</caption>
                    <thead className="bg-surface">
                        <tr className="border-b border-subtle">
                            <th scope="col" className="hidden w-[22%] px-5 py-3 text-caption font-medium text-secondary sm:table-cell">
                                <span className="sr-only">Question</span>
                            </th>
                            <th scope="col" className="px-4 py-3 text-caption font-medium text-secondary sm:px-5">
                                A typical file link
                            </th>
                            <th scope="col" className="px-4 py-3 text-caption font-medium text-strong sm:px-5">
                                A Gatekeep delivery
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {COMPARISON.map((row) => (
                            <tr key={row.label} className="border-b border-subtle last:border-0">
                                <th scope="row" className="hidden px-5 py-3.5 align-top text-body font-medium text-primary sm:table-cell">
                                    {row.label}
                                </th>
                                <td className="px-4 py-3.5 align-top text-body-sm text-tertiary sm:px-5">
                                    <span className="mb-1 block text-caption font-medium text-secondary sm:hidden">{row.label}</span>
                                    <span className="flex items-start gap-2">
                                        <Minus {...ICON} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        {row.link}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 align-top text-body-sm text-primary sm:px-5">
                                    <span className="mb-1 block text-caption font-medium text-transparent sm:hidden" aria-hidden>
                                        {row.label}
                                    </span>
                                    <span className="flex items-start gap-2">
                                        <Check {...ICON} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-strong" />
                                        {row.gatekeep}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 className="mt-16 text-h2 text-strong">Everything a delivery needs</h3>
            <ul className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-2 text-body font-medium text-strong">
                            <Icon {...ICON} className="h-4 w-4 text-secondary" />
                            {title}
                        </span>
                        <span className="text-body-sm text-secondary">{body}</span>
                    </li>
                ))}
            </ul>
        </Section>
    );
}

/* ------------------------------------------------------------------ how it works */

const STEPS: { title: string; body: string; image: StaticImageData; address: string; alt: string }[] = [
    {
        title: 'Create a delivery',
        body: 'Choose files, add people by email and decide when access ends. Each person gets an invite that names you and links to the delivery. It holds no secret.',
        image: newDeliveryShot,
        address: `${DEMO_HOST}/admin/deliveries/new`,
        alt: 'The New delivery form: a title, a message, the chosen files and the people who will receive them, each with an access method.',
    },
    {
        title: 'They open it with a code',
        body: "The recipient enters their email address and types the 6-digit code they're sent. No account, no app, no password to lose. Until then, the page shows only your name.",
        image: signInShot,
        address: `${DEMO_HOST}/k7Qm2x`,
        alt: 'The recipient sign-in page: the sender’s name and message, and a field for the 6-digit code sent to the recipient’s email.',
    },
    {
        title: 'You get the receipt',
        body: 'Opens, previews, downloads and denied attempts appear in Activity with the person, time and IP address. Export it as CSV whenever you need a record.',
        image: activityShot,
        address: `${DEMO_HOST}/admin/activity`,
        alt: 'The Activity page: totals for opens, downloads and denied attempts, and a feed of who opened or downloaded what, and when.',
    },
];

function HowItWorks() {
    return (
        <Section id="how-it-works" labelledBy="how-title">
            <SectionIntro id="how-title" eyebrow="How it works" title="From upload to receipt in three steps." />
            <ol className="mt-12 flex flex-col gap-16 md:gap-20">
                {STEPS.map((step, index) => (
                    <li key={step.title} className="grid items-start gap-6 lg:grid-cols-12 lg:gap-10">
                        <div className="lg:col-span-4 lg:pt-6">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-default bg-surface font-mono text-body-sm text-strong">
                                {index + 1}
                            </span>
                            <h3 className="mt-4 text-h2 text-strong">{step.title}</h3>
                            <p className="mt-2 text-body text-secondary">{step.body}</p>
                        </div>
                        <Screenshot
                            className="lg:col-span-8"
                            image={step.image}
                            address={step.address}
                            alt={step.alt}
                            sizes="(min-width: 1024px) 700px, 100vw"
                        />
                    </li>
                ))}
            </ol>
        </Section>
    );
}

/* ------------------------------------------------------------------ access methods */

function AccessMethods() {
    return (
        <Section id="access" labelledBy="access-title">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                    <SectionIntro id="access-title" eyebrow="Access methods" title="Email code or password?">
                        You choose for each person. Use an email code unless you have a reason not to.
                    </SectionIntro>
                    <ul className="mt-8 flex flex-col divide-y divide-gray-4 rounded-lg border border-default bg-surface">
                        <li className="flex items-start gap-4 p-5">
                            <IconTile icon={Mail} />
                            <div>
                                <p className="flex flex-wrap items-center gap-2 text-h3 text-strong">
                                    Email code <Badge>Recommended</Badge>
                                </p>
                                <p className="mt-1 text-body text-secondary">
                                    The recipient gets a 6-digit code at their email address, valid for 10 minutes. There&apos;s no password to send or
                                    lose, and a forwarded invite is useless without that inbox.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4 p-5">
                            <IconTile icon={KeyRound} />
                            <div>
                                <p className="text-h3 text-strong">Password</p>
                                <p className="mt-1 text-body text-secondary">
                                    Gatekeep makes one for each person, and you send it on another channel. Use it when someone has no email address
                                    you can use, when your Gatekeep can&apos;t send email, or when the secret should travel separately from the link.
                                </p>
                            </div>
                        </li>
                    </ul>
                    <p className="mt-5">
                        <TextLink href={ACCESS_METHODS_URL}>Read the guide</TextLink>
                    </p>
                </div>
                <div className="lg:pt-[52px]">
                    <AccessHelper />
                </div>
            </div>
        </Section>
    );
}

/* ------------------------------------------------------------------ security */

const SECURITY: { icon: LucideIcon; title: string; body: string }[] = [
    {
        icon: LockKeyhole,
        title: 'Owner-only dashboard',
        body: "Only the owner's account can use the dashboard and its API, even if sign-ups are left on in Supabase.",
    },
    {
        icon: UserCheck,
        title: 'Per-recipient access',
        body: 'Each person signs in to each delivery on their own. Sessions are random tokens, stored hashed, in httpOnly cookies.',
    },
    {
        icon: MailCheck,
        title: 'No secrets in emails',
        body: 'Invites name you and link to the delivery. Passwords never travel by email, and codes are stored hashed.',
    },
    {
        icon: EyeOff,
        title: 'Nothing shown before sign-in',
        body: 'Until someone proves who they are, the page shows your name and message. Never the title or the files.',
    },
    {
        icon: ShieldCheck,
        title: 'Enumeration-safe sign-in',
        body: 'Code requests and failed sign-ins answer the same way, at the same speed, whether or not the person is on the delivery.',
    },
    {
        icon: Gauge,
        title: 'Throttling',
        body: 'Failed attempts are counted in the database, 20 per IP and 100 per delivery every 15 minutes, across every server.',
    },
    {
        icon: Timer,
        title: 'Signed, short-lived URLs',
        body: 'Files sit in a private bucket. Each download gets a link that lasts 60 seconds, issued only after access is checked again.',
    },
    {
        icon: Database,
        title: 'Row-level security',
        body: 'Every table has row-level security, and the service-role key never leaves the server. Strict CSP and HSTS headers.',
    },
];

function Security() {
    return (
        <Section id="security" labelledBy="security-title">
            <SectionIntro id="security-title" eyebrow="Security" title="Secure by default, not by configuration.">
                The safe choice is the default everywhere, so there&apos;s nothing to switch on before you send your first file.
            </SectionIntro>
            <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-default bg-gray-5 sm:grid-cols-2 lg:grid-cols-4">
                {SECURITY.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex flex-col gap-2 bg-surface p-5">
                        <Icon {...ICON} className="h-5 w-5 text-primary" />
                        <h3 className="mt-1 text-h3 text-strong">{title}</h3>
                        <p className="text-body-sm text-secondary">{body}</p>
                    </li>
                ))}
            </ul>
            <p className="mt-6 text-body text-secondary">
                Found a vulnerability? <TextLink href={SECURITY_URL}>Report it privately</TextLink>
            </p>
        </Section>
    );
}

/* ------------------------------------------------------------------ self-host */

function SelfHost() {
    return (
        <Section id="self-host" labelledBy="self-host-title">
            <SectionIntro id="self-host-title" eyebrow="Self-host" title="Yours, running in about 10 minutes.">
                Gatekeep runs on your own Supabase project, deployed to Vercel or any server with Docker. Your files stay in your storage, under
                your name, and the code is MIT-licensed.
            </SectionIntro>

            <div className="mt-10 grid gap-4 lg:grid-cols-5">
                <div className="flex min-w-0 flex-col rounded-lg border border-default bg-surface lg:col-span-3">
                    <div className="flex flex-col gap-4 p-5">
                        <div>
                            <p className="text-caption font-medium text-tertiary">Step 1</p>
                            <h3 className="mt-1 text-h3 text-strong">Set up the database and your account</h3>
                            <p className="mt-1 text-body-sm text-secondary">
                                Create a Supabase project (the free plan is enough to start) and put its URL and keys in{' '}
                                <code className="font-mono text-primary">.env.local</code>. Then apply the schema and create the account you&apos;ll
                                sign in with.
                            </p>
                        </div>
                        <CopyField multiline label="Setup commands" value={SETUP_COMMANDS} />
                    </div>
                    <div className="mt-auto border-t border-subtle p-5">
                        <p className="text-caption font-medium text-tertiary">Step 3</p>
                        <h3 className="mt-1 text-h3 text-strong">Check System status</h3>
                        <p className="mt-1 text-body-sm text-secondary">
                            Sign in and open Settings → System status. It checks email, the daily job, sign-ups, storage and migrations, and says
                            what to change.
                        </p>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-default bg-surface p-5">
                        <p className="text-caption font-medium text-tertiary">Step 2 · Vercel</p>
                        <h3 className="text-h3 text-strong">Deploy in one click</h3>
                        <p className="text-body-sm text-secondary">
                            Paste your Supabase keys and public URL. The daily keep-alive job is already set up in vercel.json.
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-4 pt-1">
                            <a href={DEPLOY_URL} {...EXTERNAL} className={buttonStyles({ variant: 'primary' })}>
                                Deploy to Vercel
                                <ArrowUpRight {...ICON} className="h-4 w-4" />
                            </a>
                            <TextLink href={DEPLOYMENT_URL}>Guide</TextLink>
                        </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-default bg-surface p-5">
                        <p className="text-caption font-medium text-tertiary">Step 2 · Docker</p>
                        <h3 className="text-h3 text-strong">Or run it on your own server</h3>
                        <CopyField multiline label="Docker commands" value={DOCKER_COMMAND} />
                        <p className="text-body-sm text-secondary">Starts the app and a daily keep-alive job. Put it behind your own TLS proxy.</p>
                        <div className="mt-auto">
                            <TextLink href={DOCKER_URL}>Guide</TextLink>
                        </div>
                    </div>
                </div>
            </div>
        </Section>
    );
}

/* ------------------------------------------------------------------ FAQ */

function Faq() {
    const items: { q: string; a: ReactNode }[] = [
        {
            q: 'Do recipients need an account?',
            a: (
                <p>
                    No. They open your link, enter their email address and type the 6-digit code they&apos;re sent, or the password you gave
                    them. There&apos;s nothing to install or sign up for, and they can come back later on any device.
                </p>
            ),
        },
        {
            q: 'Email code or password?',
            a: (
                <>
                    <p>
                        Use an email code unless the recipient has no email address you can use, your Gatekeep can&apos;t send email, or you want
                        the secret to travel on a different channel than the link. In those cases, use a password and send it separately.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <AccessHelper variant="dialog" />
                        <TextLink href={ACCESS_METHODS_URL}>Read the guide</TextLink>
                    </div>
                </>
            ),
        },
        {
            q: 'Where are files stored?',
            a: (
                <p>
                    In a private storage bucket in your own Supabase project. Uploads go straight from your browser to your storage, and
                    recipients only ever get signed links that expire within minutes. Gatekeep has no servers of its own.
                </p>
            ),
        },
        {
            q: 'Can I take access back?',
            a: (
                <p>
                    Yes, at any time. Remove one person and everyone else keeps their access. If their page is open when you do, it closes
                    on the spot and tells them their access was removed. End dates and download limits take effect the same way, on their own.
                </p>
            ),
        },
        {
            q: 'Can clients send files to me?',
            a: (
                <p>
                    Yes. A request is a link that lets people upload files to you, with the same access controls as a delivery. Uploads land in
                    the folder you choose, and you get one email per batch.
                </p>
            ),
        },
        {
            q: 'What does it cost?',
            a: (
                <p>
                    Gatekeep is free and open source under the MIT license. You pay only for your own hosting, and Supabase&apos;s free plan is
                    enough to start. There&apos;s no paid plan and nothing to sign up for.
                </p>
            ),
        },
        {
            q: 'Can I use my own domain and branding?',
            a: (
                <p>
                    Yes. Deploy it on your own domain, then add your name, organization, logo and a message for recipients in Settings →
                    Branding. Invites arrive as &ldquo;Your name via Gatekeep&rdquo; and replies go to you. This homepage can also become a
                    simple branded welcome.
                </p>
            ),
        },
        {
            q: 'How do I know it’s working?',
            a: (
                <p>
                    Settings → System status checks email, the daily job, sign-ups, storage and migrations, and tells you what to change. For
                    uptime monitoring, <code className="rounded-sm bg-inset px-1 py-0.5 font-mono text-body-sm text-primary">GET /api/health</code>{' '}
                    returns 200 when the app can reach its database and 503 when it can&apos;t.
                </p>
            ),
        },
        {
            q: 'I use Gatekeep 1.x. Do my links keep working?',
            a: (
                <p>
                    Yes. The upgrade turns every existing link into a delivery with the same address, each recipient keeps their password, and
                    the access log carries over into Activity. Recipients sign in once more.
                </p>
            ),
        },
    ];

    return (
        <Section id="faq" labelledBy="faq-title">
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
                <div>
                    <SectionIntro id="faq-title" eyebrow="FAQ" title="Questions, answered." />
                    <p className="mt-3 text-body text-secondary">
                        Something else? <TextLink href={`${REPO_URL}/discussions`}>Ask on GitHub</TextLink>
                    </p>
                </div>
                <div className="divide-y divide-gray-4 border-y border-subtle">
                    {items.map(({ q, a }) => (
                        <details key={q} className="group">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-h3 text-strong">
                                {q}
                                <span
                                    aria-hidden
                                    className="flex h-6 w-6 shrink-0 items-center justify-center text-secondary transition-transform duration-150 group-open:rotate-45"
                                >
                                    <Plus {...ICON} className="h-4 w-4" />
                                </span>
                            </summary>
                            <div className="pb-5 pr-10 text-body text-secondary">{a}</div>
                        </details>
                    ))}
                </div>
            </div>
        </Section>
    );
}

/* ------------------------------------------------------------------ closing */

function FinalCta() {
    return (
        <section aria-labelledby="cta-title" className="border-t border-subtle py-16 md:py-24">
            <Container>
                <div className="flex flex-col items-start gap-6 rounded-lg border border-default bg-surface p-6 md:flex-row md:items-center md:justify-between md:p-10">
                    <div className="flex items-start gap-4">
                        <LogoMark size={40} />
                        <div>
                            <h2 id="cta-title" className="text-h1 text-strong">
                                Send your next file with a receipt.
                            </h2>
                            <p className="mt-1 text-h3 font-normal text-secondary">Free, open source and yours to run.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <a href={DEPLOY_URL} {...EXTERNAL} className={buttonStyles({ variant: 'primary', size: 'lg' })}>
                            Deploy your own
                            <ArrowUpRight {...ICON} className="h-4 w-4" />
                        </a>
                        <a href={DOCS_URL} {...EXTERNAL} className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
                            Read the docs
                        </a>
                    </div>
                </div>
            </Container>
        </section>
    );
}

function Footer() {
    const link = 'rounded-sm text-secondary underline-offset-4 hover:text-strong hover:underline';
    return (
        <footer className="border-t border-subtle">
            <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm text-tertiary">
                    <Logo size={20} />
                    <span className="hidden sm:inline" aria-hidden>
                        ·
                    </span>
                    <span>
                        © 2026 Om Singh ·{' '}
                        <a href={LICENSE_URL} {...EXTERNAL} className={link}>
                            MIT License
                        </a>{' '}
                        ·{' '}
                        <a href={REPO_URL} {...EXTERNAL} className={link}>
                            GitHub
                        </a>{' '}
                        ·{' '}
                        <a href={DOCS_URL} {...EXTERNAL} className={link}>
                            Docs
                        </a>
                    </span>
                </div>
                <Link href="/login" className={cn(link, 'text-body-sm')}>
                    Sign in
                </Link>
            </Container>
        </footer>
    );
}

/** The product page at `/` (homepage = 'landing', and on every fresh install). */
export default function Landing() {
    return (
        <div className="min-h-dvh bg-canvas">
            <a
                href="#main"
                className="sr-only rounded-md bg-gray-10 px-3 py-2 text-body font-medium text-gray-1 focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
            >
                Skip to content
            </a>
            <Header />
            <main id="main">
                <Hero />
                <BuiltFor />
                <Product />
                <HowItWorks />
                <AccessMethods />
                <Security />
                <SelfHost />
                <Faq />
                <FinalCta />
            </main>
            <Footer />
        </div>
    );
}
