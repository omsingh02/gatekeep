'use client';

import { useState, type ReactNode } from 'react';
import {
    Download,
    Eye,
    EyeOff,
    FileText,
    FolderOpen,
    Inbox,
    Link2,
    MailCheck,
    Plus,
    Search,
    Send,
    Trash2,
    Upload,
    UserMinus,
} from 'lucide-react';
import {
    Avatar,
    Badge,
    Breadcrumb,
    Button,
    Callout,
    Card,
    CardBody,
    CardHeader,
    Checkbox,
    ConfirmDialog,
    CopyField,
    DateTimePicker,
    Dialog,
    EmptyState,
    Field,
    IconButton,
    Input,
    Kbd,
    Logo,
    LogoMark,
    Menu,
    PageHeader,
    PromptDialog,
    Radio,
    SegmentedControl,
    Select,
    Skeleton,
    StatCard,
    StatusPill,
    Switch,
    TabNav,
    Table,
    Tabs,
    TBody,
    TD,
    TH,
    THead,
    TR,
    Textarea,
    ToastProvider,
    Toolbar,
    Tooltip,
    useToast,
    type SortDirection,
} from '@/components/ds';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4' } as const;

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-6 border-t border-subtle py-10 first:border-t-0 first:pt-0">
            <h2 className="text-h2 text-strong">{title}</h2>
            {description && <p className="mt-1 max-w-2xl text-body-sm text-secondary">{description}</p>}
            <div className="mt-6">{children}</div>
        </section>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-3 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
            <span className="text-caption font-medium text-tertiary">{label}</span>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

const GRAYS = [
    ['gray-0', '#111111', 'inset'],
    ['gray-1', '#1a1a1a', 'canvas'],
    ['gray-2', '#212121', 'surface'],
    ['gray-3', '#2a2a2a', 'raised'],
    ['gray-4', '#333333', 'border subtle'],
    ['gray-5', '#3a3a3a', 'border'],
    ['gray-6', '#4a4a4a', 'border strong'],
    ['gray-7', '#737373', 'text tertiary'],
    ['gray-8', '#a3a3a3', 'text secondary'],
    ['gray-9', '#e0e0e0', 'text primary'],
    ['gray-10', '#f5f5f5', 'text strong · primary button'],
] as const;

const RECIPIENTS = [
    { name: 'maya@northwind.example', method: 'Email code', status: 'Active', tone: 'success' as const, opened: '2 hours ago', downloads: '1 of 3' },
    { name: 'j.chen', method: 'Password', status: 'Ends in 2 days', tone: 'warning' as const, opened: 'Yesterday', downloads: '2 of 5' },
    { name: 'ops@acme.example', method: 'Email code', status: 'Ended', tone: 'danger' as const, opened: 'Oct 2', downloads: '0' },
    { name: 'Anyone with the password', method: 'Password', status: 'Active', tone: 'success' as const, opened: 'Never', downloads: '—' },
];

function Preview() {
    const toast = useToast();
    const [tab, setTab] = useState<'recipients' | 'files' | 'activity'>('recipients');
    const [method, setMethod] = useState<'email_code' | 'password'>('email_code');
    const [view, setView] = useState<'table' | 'grid'>('table');
    const [notify, setNotify] = useState(true);
    const [digest, setDigest] = useState(false);
    const [endsAt, setEndsAt] = useState<Date | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set([0]));
    const [sort, setSort] = useState<SortDirection>('desc');
    const [dialog, setDialog] = useState<'none' | 'form' | 'confirm' | 'prompt'>('none');

    const allSelected = selected.size === RECIPIENTS.length;

    return (
        <div className="min-h-screen bg-canvas text-primary">
            <header className="border-b border-subtle bg-surface">
                <div className="mx-auto flex h-14 max-w-app items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center gap-3">
                        <Logo size={24} />
                        <Badge>Design system</Badge>
                    </div>
                    <span className="hidden text-caption text-tertiary sm:inline">Gatekeep Mono · dev only</span>
                </div>
                <div className="mx-auto max-w-app px-4 sm:px-8">
                    <TabNav
                        label="Design system sections"
                        items={[
                            { href: '#foundations', label: 'Foundations', active: true },
                            { href: '#actions', label: 'Actions', active: false },
                            { href: '#forms', label: 'Forms', active: false },
                            { href: '#data', label: 'Data', active: false },
                            { href: '#overlays', label: 'Overlays', active: false },
                            { href: '#brand', label: 'Brand', active: false },
                        ]}
                    />
                </div>
            </header>

            <main className="mx-auto max-w-app px-4 py-10 sm:px-8">
                <Section id="foundations" title="Foundations" description="Pure grey scale (R = G = B). Colour appears only to communicate status.">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                        {GRAYS.map(([name, hex, role]) => (
                            <div key={name} className="overflow-hidden rounded-lg border border-default">
                                <div className="h-14" style={{ background: hex }} />
                                <div className="bg-surface px-2.5 py-2">
                                    <p className="text-caption font-medium text-strong">{name}</p>
                                    <p className="font-mono text-caption text-tertiary">{hex}</p>
                                    <p className="truncate text-caption text-secondary">{role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                        <StatusPill tone="success">Success · active, unlocked</StatusPill>
                        <StatusPill tone="warning">Warning · ending soon, limit</StatusPill>
                        <StatusPill tone="danger">Danger · denied, ended</StatusPill>
                        <StatusPill tone="neutral">Neutral · info</StatusPill>
                    </div>

                    <Card className="mt-6">
                        <p className="text-display text-strong">Send it. See who opened it.</p>
                        <p className="mt-4 text-h1 text-strong">Deliveries · h1 24/32</p>
                        <p className="mt-2 text-h2 text-strong">Recipients · h2 18/26</p>
                        <p className="mt-2 text-h3 text-strong">Q3 board pack · h3 15/22</p>
                        <p className="mt-2 text-body text-primary">Body 14/20. Maya opened the delivery and downloaded 2 of 3 files.</p>
                        <p className="mt-1 text-body-sm text-secondary">Body small 13/18. Secondary information and table cells.</p>
                        <p className="mt-1 text-caption text-tertiary">Caption 12/16 · labels, helper text, metadata</p>
                        <p className="mt-2 font-mono text-body-sm text-primary">gatekeep.example.com/aB3xY9 · mono</p>
                        <p className="mt-2 text-body tabular-nums text-primary">1,284 opens · 36 downloads · 12.4 MB (tabular numbers)</p>
                    </Card>
                </Section>

                <Section id="actions" title="Actions" description="One button set. Primary is near-white; destructive confirms use solid danger.">
                    <Card>
                        <Row label="Variants">
                            <Button variant="primary" icon={<Send {...ICON} />}>
                                Send delivery
                            </Button>
                            <Button variant="secondary" icon={<Link2 {...ICON} />}>
                                Copy link
                            </Button>
                            <Button variant="ghost">Cancel</Button>
                            <Button variant="danger" icon={<UserMinus {...ICON} />}>
                                Remove access
                            </Button>
                            <Button variant="danger-solid">Delete file</Button>
                            <Button variant="link">Help me choose</Button>
                        </Row>
                        <Row label="Sizes">
                            <Button variant="primary" size="sm">
                                Small
                            </Button>
                            <Button variant="primary" size="md">
                                Medium
                            </Button>
                            <Button variant="primary" size="lg">
                                Large
                            </Button>
                            <Button variant="secondary" size="sm">
                                Small
                            </Button>
                            <Button variant="secondary" size="lg">
                                Large
                            </Button>
                        </Row>
                        <Row label="States">
                            <Button variant="primary" loading>
                                Sending…
                            </Button>
                            <Button variant="secondary" loading>
                                Saving…
                            </Button>
                            <Button variant="primary" disabled>
                                Disabled
                            </Button>
                            <Button variant="secondary" disabled>
                                Disabled
                            </Button>
                        </Row>
                        <Row label="Icon buttons">
                            <IconButton label="Download Q3 deck.pdf" icon={<Download {...ICON} />} />
                            <IconButton label="Preview" icon={<Eye {...ICON} />} variant="secondary" />
                            <IconButton label="Delete" icon={<Trash2 {...ICON} />} variant="danger" />
                            <Menu
                                label="More actions for Q3 deck.pdf"
                                items={[
                                    { label: 'Copy link', icon: <Link2 {...ICON} />, onSelect: () => toast.success('Link copied') },
                                    { label: 'Resend invite', icon: <MailCheck {...ICON} />, onSelect: () => toast.info('Invite sent to maya@northwind.example') },
                                    { type: 'separator' },
                                    { label: 'Remove access', icon: <UserMinus {...ICON} />, danger: true, onSelect: () => setDialog('confirm') },
                                ]}
                            />
                            <Tooltip content="Copy the delivery link">
                                <Button variant="secondary" size="sm" icon={<Link2 {...ICON} />}>
                                    Hover me
                                </Button>
                            </Tooltip>
                            <span className="text-caption text-tertiary">
                                Shortcut <Kbd>⌘</Kbd> <Kbd>K</Kbd>
                            </span>
                        </Row>
                    </Card>
                </Section>

                <Section id="forms" title="Forms" description="One input style. Labels above, helper or error below, never native validation bubbles.">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="flex flex-col gap-5">
                            <Field label="Recipient email" helper="We'll send a 6-digit code to this address when they open the link.">
                                <Input type="email" placeholder="name@company.com" defaultValue="maya@northwind.example" />
                            </Field>
                            <Field label="Search" hideLabel>
                                <Input leading={<Search {...ICON} />} placeholder="Search files and deliveries" />
                            </Field>
                            <Field label="Password" error="Use a password of at least 8 characters.">
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    defaultValue="short"
                                    mono
                                    trailing={
                                        <IconButton
                                            size="sm"
                                            label={showPassword ? 'Hide password' : 'Show password'}
                                            icon={showPassword ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                                            onClick={() => setShowPassword((s) => !s)}
                                        />
                                    }
                                />
                            </Field>
                            <Field label="Download limit" helper="Optional">
                                <Input type="number" inputMode="numeric" placeholder="No limit" min={1} />
                            </Field>
                            <Field label="Message" helper="Optional · shown to recipients on the delivery page">
                                <Textarea placeholder="Here's the final Q3 board pack. Let me know if anything's missing." />
                            </Field>
                            <Field label="Folder">
                                <Select defaultValue="clients">
                                    <option value="all">All files</option>
                                    <option value="clients">Clients</option>
                                    <option value="finance">Finance</option>
                                </Select>
                            </Field>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Read only">
                                    <Input readOnly mono defaultValue="aB3xY9" />
                                </Field>
                                <Field label="Disabled">
                                    <Input disabled defaultValue="Not available" />
                                </Field>
                            </div>
                            <Field label="Large (recipient and sign-in screens)">
                                <Input size="lg" placeholder="you@company.com" />
                            </Field>
                        </Card>

                        <Card className="flex flex-col gap-5">
                            <Field
                                label="Access method"
                                labelAction={
                                    <Button variant="link" className="text-caption">
                                        Help me choose
                                    </Button>
                                }
                            >
                                <SegmentedControl
                                    label="Access method"
                                    value={method}
                                    onChange={setMethod}
                                    options={[
                                        { value: 'email_code', label: 'Email code' },
                                        { value: 'password', label: 'Password' },
                                    ]}
                                />
                            </Field>
                            <SegmentedControl
                                label="View"
                                size="sm"
                                value={view}
                                onChange={setView}
                                options={[
                                    { value: 'table', label: 'Table' },
                                    { value: 'grid', label: 'Grid' },
                                ]}
                            />
                            <div className="flex flex-col gap-3">
                                <Checkbox label="Send the invite by email" description="The invite contains the link only, never a password." defaultChecked />
                                <Checkbox label="Allow downloads" />
                                <Checkbox label="Indeterminate" indeterminate />
                                <Checkbox label="Disabled" disabled />
                            </div>
                            <fieldset className="flex flex-col gap-3">
                                <legend className="mb-2 text-caption font-medium text-secondary">When someone is denied</legend>
                                <Radio name="denied" label="Email me after 3 denied attempts" defaultChecked />
                                <Radio name="denied" label="Email me every time" />
                                <Radio name="denied" label="Don't email me" description="Denied attempts still appear in Activity." />
                            </fieldset>
                            <div className="flex flex-col gap-4 border-t border-subtle pt-4">
                                <Switch checked={notify} onCheckedChange={setNotify} label="Email me when a delivery is opened" description="First open per person, per day." />
                                <Switch checked={digest} onCheckedChange={setDigest} label="Daily summary" />
                                <Switch checked={false} onCheckedChange={() => {}} label="Disabled setting" disabled />
                            </div>
                            <Field label="Access ends">
                                <DateTimePicker label="Access ends" value={endsAt} onChange={setEndsAt} />
                            </Field>
                        </Card>
                    </div>
                </Section>

                <Section id="data" title="Data display" description="Flat cards, dense tables, status as pills with a dot. Numbers never coloured.">
                    <PageHeader
                        breadcrumb={<Breadcrumb items={[{ label: 'Deliveries', href: '#data' }, { label: 'Q3 board pack' }]} />}
                        title="Q3 board pack"
                        description="3 files · sent to 4 recipients · created Oct 6"
                        actions={
                            <>
                                <Button variant="secondary" icon={<Link2 {...ICON} />} onClick={() => toast.success('Link copied')}>
                                    Copy link
                                </Button>
                                <Button variant="primary" icon={<Plus {...ICON} />} onClick={() => setDialog('form')}>
                                    Add people
                                </Button>
                            </>
                        }
                    />

                    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard label="Opens" value="128" detail="12 this week" />
                        <StatCard label="Downloads" value="36" detail="3 of 3 files" />
                        <StatCard label="Denied attempts" value="4" status="warning" detail="Last: wrong password" />
                        <StatCard label="Recipients" value="4" detail="1 ended" />
                    </div>

                    <Tabs
                        className="mt-8"
                        label="Delivery sections"
                        value={tab}
                        onChange={setTab}
                        items={[
                            { value: 'recipients', label: 'Recipients', count: 4 },
                            { value: 'files', label: 'Files', count: 3 },
                            { value: 'activity', label: 'Activity' },
                        ]}
                    />

                    <Card flush className="mt-4">
                        <CardHeader
                            title="Recipients"
                            description="Each person has their own access."
                            actions={
                                <Toolbar>
                                    <div className="w-56">
                                        <Input leading={<Search {...ICON} />} placeholder="Filter" aria-label="Filter recipients" />
                                    </div>
                                    {selected.size > 0 && (
                                        <Button variant="danger" size="md" icon={<UserMinus {...ICON} />} onClick={() => setDialog('confirm')}>
                                            Remove {selected.size}
                                        </Button>
                                    )}
                                </Toolbar>
                            }
                        />
                        <Table>
                            <THead>
                                <tr>
                                    <TH className="w-10">
                                        <Checkbox
                                            aria-label="Select all recipients"
                                            checked={allSelected}
                                            indeterminate={selected.size > 0 && !allSelected}
                                            onChange={() => setSelected(allSelected ? new Set() : new Set(RECIPIENTS.map((_, i) => i)))}
                                        />
                                    </TH>
                                    <TH>Recipient</TH>
                                    <TH>Access method</TH>
                                    <TH>Status</TH>
                                    <TH sort={sort} onSort={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}>
                                        Last opened
                                    </TH>
                                    <TH numeric>Downloads</TH>
                                    <TH className="w-12">
                                        <span className="sr-only">Actions</span>
                                    </TH>
                                </tr>
                            </THead>
                            <TBody>
                                {RECIPIENTS.map((r, i) => (
                                    <TR key={r.name} selected={selected.has(i)}>
                                        <TD>
                                            <Checkbox
                                                aria-label={`Select ${r.name}`}
                                                checked={selected.has(i)}
                                                onChange={() =>
                                                    setSelected((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(i)) next.delete(i);
                                                        else next.add(i);
                                                        return next;
                                                    })
                                                }
                                            />
                                        </TD>
                                        <TD strong>
                                            <span className="flex items-center gap-2.5">
                                                <Avatar name={r.name} size="sm" />
                                                <span className="truncate">{r.name}</span>
                                            </span>
                                        </TD>
                                        <TD>
                                            <Badge>{r.method}</Badge>
                                        </TD>
                                        <TD>
                                            <StatusPill tone={r.tone}>{r.status}</StatusPill>
                                        </TD>
                                        <TD>{r.opened}</TD>
                                        <TD numeric>{r.downloads}</TD>
                                        <TD>
                                            <Menu
                                                label={`Actions for ${r.name}`}
                                                items={[
                                                    { label: 'Resend invite', onSelect: () => toast.info(`Invite sent to ${r.name}`) },
                                                    { label: 'Change end date', onSelect: () => {} },
                                                    { type: 'separator' },
                                                    { label: 'Remove access', danger: true, onSelect: () => setDialog('confirm') },
                                                ]}
                                            />
                                        </TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    </Card>

                    <div className="mt-6 grid gap-6 lg:grid-cols-2">
                        <Card flush>
                            <CardHeader title="Empty state" />
                            <EmptyState
                                icon={Inbox}
                                title="No deliveries yet"
                                description="Pick files, add the people who should receive them, and send one link."
                                action={
                                    <Button variant="primary" icon={<Plus {...ICON} />}>
                                        New delivery
                                    </Button>
                                }
                            />
                        </Card>
                        <Card flush>
                            <CardHeader title="Loading" description="Skeletons match the final layout" />
                            <CardBody className="flex flex-col gap-4">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <div className="flex flex-1 flex-col gap-2">
                                            <Skeleton className="h-3 w-2/3" />
                                            <Skeleton className="h-3 w-1/3" />
                                        </div>
                                        <Skeleton className="h-5 w-16" />
                                    </div>
                                ))}
                            </CardBody>
                        </Card>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <Callout title="Email isn't set up on this Gatekeep">
                            Email codes need `RESEND_API_KEY` and `EMAIL_FROM`. Until then, recipients use a password.
                        </Callout>
                        <Callout tone="warning" title="Access ends in 2 days" action={<Button size="sm">Extend</Button>}>
                            j.chen can open this delivery until Oct 9 at 6:00 PM.
                        </Callout>
                        <Callout tone="danger">That email, username or password doesn&apos;t match. Check what you were sent and try again.</Callout>
                        <Callout tone="success">Delivery sent to 3 people.</Callout>
                    </div>
                </Section>

                <Section id="overlays" title="Overlays and feedback" description="One dialog, one menu, one toast. Focus is trapped and restored; Escape closes.">
                    <Card>
                        <Row label="Dialogs">
                            <Button variant="secondary" onClick={() => setDialog('form')}>
                                Open dialog
                            </Button>
                            <Button variant="secondary" onClick={() => setDialog('confirm')}>
                                Confirm (destructive)
                            </Button>
                            <Button variant="secondary" onClick={() => setDialog('prompt')}>
                                Prompt
                            </Button>
                        </Row>
                        <Row label="Toasts">
                            <Button variant="secondary" onClick={() => toast.success('Delivery sent to 3 people', { action: { label: 'View', onClick: () => {} } })}>
                                Success
                            </Button>
                            <Button variant="secondary" onClick={() => toast.warning('Moved 2 of 3 items. 1 couldn’t be moved.')}>
                                Warning
                            </Button>
                            <Button variant="secondary" onClick={() => toast.error('Couldn’t upload contract.pdf. Check your connection and try again.')}>
                                Error
                            </Button>
                            <Button variant="secondary" onClick={() => toast.info('Invite sent to maya@northwind.example')}>
                                Neutral
                            </Button>
                        </Row>
                        <Row label="Copy fields">
                            <div className="flex w-full max-w-xl flex-col gap-2">
                                <CopyField label="Delivery link" value="https://gatekeep.example.com/aB3xY9" />
                                <CopyField label="Password" value="harbor-violet-42" masked />
                                <CopyField
                                    label="Invite"
                                    multiline
                                    value={'Maya Chen shared "Q3 board pack" with you.\n\nOpen: https://gatekeep.example.com/aB3xY9\nYou\'ll get a 6-digit code at maya@northwind.example.'}
                                />
                            </div>
                        </Row>
                    </Card>
                </Section>

                <Section id="brand" title="Brand" description="Monochrome mark with the gate and keyhole knocked out. Inverted for light backgrounds.">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card className="flex flex-wrap items-center gap-6">
                            <LogoMark size={64} />
                            <LogoMark size={32} />
                            <LogoMark size={16} />
                            <Logo size={32} />
                        </Card>
                        <div className="flex flex-wrap items-center gap-6 rounded-lg border border-default bg-white p-5">
                            <LogoMark size={64} inverted />
                            <LogoMark size={32} inverted />
                            <LogoMark size={16} inverted />
                            <Logo size={32} inverted />
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-body-sm text-secondary">
                        <FolderOpen {...ICON} /> <FileText {...ICON} /> <Upload {...ICON} /> <Download {...ICON} /> <Send {...ICON} /> lucide, stroke 1.75
                    </div>
                </Section>
            </main>

            <Dialog
                open={dialog === 'form'}
                onClose={() => setDialog('none')}
                title="Add people"
                description="Q3 board pack · each person gets their own access."
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setDialog('none')}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            icon={<Send {...ICON} />}
                            onClick={() => {
                                setDialog('none');
                                toast.success('Invites sent to 2 people');
                            }}
                        >
                            Add and send invites
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label="Emails or usernames" helper="Separate with commas or new lines.">
                        <Textarea defaultValue={'maya@northwind.example\nj.chen'} mono />
                    </Field>
                    <Field label="Access method">
                        <SegmentedControl
                            label="Access method"
                            value={method}
                            onChange={setMethod}
                            options={[
                                { value: 'email_code', label: 'Email code' },
                                { value: 'password', label: 'Password' },
                            ]}
                        />
                    </Field>
                    <Callout>j.chen is a username, so they&apos;ll use a password. You&apos;ll get it to send separately.</Callout>
                </div>
            </Dialog>

            <ConfirmDialog
                open={dialog === 'confirm'}
                onClose={() => setDialog('none')}
                onConfirm={() => {
                    setDialog('none');
                    toast.success("Removed Maya's access to Q3 board pack");
                }}
                title="Remove Maya’s access?"
                confirmLabel="Remove access"
                destructive
            >
                maya@northwind.example won&apos;t be able to open Q3 board pack any more. If the delivery is open now, it closes for them immediately.
            </ConfirmDialog>

            <PromptDialog
                open={dialog === 'prompt'}
                onClose={() => setDialog('none')}
                onSubmit={(name) => {
                    setDialog('none');
                    toast.success(`Folder "${name}" created`);
                }}
                title="New folder"
                label="Folder name"
                placeholder="Clients"
                submitLabel="Create folder"
            />
        </div>
    );
}

export default function DesignPreview() {
    return (
        <ToastProvider>
            <Preview />
        </ToastProvider>
    );
}
