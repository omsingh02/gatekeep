'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { ExternalLink, ImageIcon, Mail, Trash2, Upload } from 'lucide-react';
import { Button, Card, Field, Input, Radio, Textarea, cn, useToast } from '@/components/ds';
import { SenderBlock } from '@/components/recipient/Shell';
import { readError, senderPreview, useDirtySection, useSettings, type OwnerSettings } from '../SettingsContext';
import { SettingsSection, WithSettings } from '../SettingsShell';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
const MAX_MESSAGE = 500;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function LogoImage({ src, className }: { src: string; className?: string }) {
    // A user-uploaded image on the Supabase public bucket: plain <img>, no optimisation needed
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Your logo" className={cn('object-contain', className)} />;
}

function LogoCard({ settings }: { settings: OwnerSettings }) {
    const { update } = useSettings();
    const toast = useToast();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const upload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!LOGO_TYPES.includes(file.type)) return setError('Use a PNG, JPEG or WebP image.');
        if (file.size > MAX_LOGO_BYTES) return setError('Use an image of at most 2 MB.');
        setError(null);
        setBusy('upload');
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/settings/logo', { method: 'POST', body: form });
            if (!res.ok) throw new Error(await readError(res));
            const { logoUrl } = (await res.json()) as { logoUrl: string };
            update({ logoUrl });
            toast.success('Logo updated');
        } catch (err) {
            setError(err instanceof Error ? err.message : "We couldn't upload the logo. Try again.");
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        setBusy('remove');
        try {
            const res = await fetch('/api/settings/logo', { method: 'DELETE' });
            if (!res.ok) throw new Error(await readError(res));
            update({ logoUrl: null });
            toast.success('Logo removed');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "We couldn't remove the logo. Try again.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <SettingsSection title="Logo" description="Shown with your name on delivery pages and on your homepage.">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default bg-inset">
                    {settings.logoUrl ? (
                        <LogoImage src={settings.logoUrl} className="h-full w-full p-1.5" />
                    ) : (
                        <ImageIcon aria-hidden strokeWidth={1.75} className="h-5 w-5 text-tertiary" />
                    )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                        <Button icon={<Upload {...ICON} />} loading={busy === 'upload'} disabled={busy !== null} onClick={() => input.current?.click()}>
                            {settings.logoUrl ? 'Replace logo' : 'Upload logo'}
                        </Button>
                        {settings.logoUrl && (
                            <Button variant="danger" icon={<Trash2 {...ICON} />} loading={busy === 'remove'} disabled={busy !== null} onClick={remove}>
                                Remove logo
                            </Button>
                        )}
                    </div>
                    <p className={cn('text-caption', error ? 'text-danger' : 'text-tertiary')} role={error ? 'alert' : undefined}>
                        {error ?? 'PNG, JPEG or WebP, up to 2 MB. A square image works best.'}
                    </p>
                </div>
                <input ref={input} type="file" accept={LOGO_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden onChange={upload} />
            </div>
        </SettingsSection>
    );
}

/** The recipient's sign-in card as it really looks (components/recipient/SignIn.tsx), with this message. */
function RecipientPreview({ settings, message }: { settings: OwnerSettings; message: string }) {
    const displayName = settings.displayName?.trim() ?? '';
    const organization = settings.organization?.trim() ?? '';
    const sender = {
        name: displayName || organization || settings.ownerEmail || 'The sender',
        label: senderPreview(displayName, organization, settings.ownerEmail),
        logoUrl: settings.logoUrl,
        message: message.trim() || null,
    };
    return (
        <div className="rounded-lg border border-subtle bg-canvas px-4 py-8 sm:px-8" aria-label="Preview of a delivery page" role="img">
            {/* inert: a picture of the page, nothing in it can be focused or typed into */}
            <Card inert className="mx-auto flex w-full max-w-card flex-col gap-6 p-6 sm:p-6">
                <SenderBlock sender={sender} />
                <div className="flex flex-col gap-1.5">
                    <p className="text-h2 text-strong">{sender.name} sent you files</p>
                    <p className="text-body text-secondary">Enter your email address and we&apos;ll send you a code to open them.</p>
                </div>
                <p
                    className={cn(
                        'whitespace-pre-line break-words border-l-2 border-default pl-3 text-body-sm',
                        sender.message ? 'text-secondary' : 'text-tertiary'
                    )}
                >
                    {sender.message ?? 'Your message to recipients appears here.'}
                </p>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-caption font-medium text-secondary">Email</span>
                        <Input size="lg" tabIndex={-1} placeholder="name@company.com" aria-hidden />
                    </div>
                    <Button variant="primary" size="lg" fullWidth className="pointer-events-none" tabIndex={-1} aria-hidden icon={<Mail {...ICON} />}>
                        Send code
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function MessageForm({ settings }: { settings: OwnerSettings }) {
    const { save } = useSettings();
    const toast = useToast();
    const [message, setMessage] = useState(settings.recipientMessage ?? '');
    const [baseline, setBaseline] = useState(message);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dirty = message !== baseline;
    useDirtySection('branding', dirty);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (message.trim().length > MAX_MESSAGE) return setError(`Use at most ${MAX_MESSAGE} characters.`);
        setError(null);
        setSaving(true);
        try {
            const saved = await save({ recipientMessage: message });
            const clean = saved.recipientMessage ?? '';
            setMessage(clean);
            setBaseline(clean);
            toast.success('Message saved');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "We couldn't save the message. Try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection
            title="Message to recipients"
            description="Shown on every delivery page, under your name. Each delivery can add its own message too."
            onSubmit={onSubmit}
            saveLabel="Save message"
            saving={saving}
            dirty={dirty}
        >
            <Field label="Message" helper={`Optional · ${message.trim().length} of ${MAX_MESSAGE} characters`} error={error}>
                <Textarea
                    rows={3}
                    value={message}
                    maxLength={MAX_MESSAGE + 50}
                    placeholder="Files from Northwind. Reply to this email with any questions."
                    onChange={(e) => setMessage(e.target.value)}
                />
            </Field>
            <div className="flex flex-col gap-1.5">
                <span className="text-caption font-medium text-secondary">Preview</span>
                <RecipientPreview settings={settings} message={message} />
            </div>
        </SettingsSection>
    );
}

function HomepageForm({ settings }: { settings: OwnerSettings }) {
    const { save } = useSettings();
    const toast = useToast();
    const [homepage, setHomepage] = useState(settings.homepage);
    const [baseline, setBaseline] = useState(settings.homepage);
    const [saving, setSaving] = useState(false);
    const dirty = homepage !== baseline;
    useDirtySection('homepage', dirty);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        try {
            const saved = await save({ homepage });
            setHomepage(saved.homepage);
            setBaseline(saved.homepage);
            toast.success('Homepage saved');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "We couldn't save the homepage. Try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection
            title="Homepage"
            description="What people see when they open this site's address without a delivery link."
            onSubmit={onSubmit}
            saveLabel="Save homepage"
            saving={saving}
            dirty={dirty}
            footerStart={
                dirty ? undefined : (
                    <Link
                        href="/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:text-strong hover:underline focus-ring"
                    >
                        View homepage
                        <ExternalLink aria-hidden strokeWidth={1.75} className="h-3 w-3" />
                    </Link>
                )
            }
        >
            <fieldset className="flex flex-col gap-2.5">
                <legend className="sr-only">Homepage</legend>
                <Radio
                    name="homepage"
                    value="branded"
                    checked={homepage === 'branded'}
                    onChange={() => setHomepage('branded')}
                    label="Branded welcome"
                    description="Your name and logo, and a note to use the link they were sent. New installs start with this."
                />
                <Radio
                    name="homepage"
                    value="landing"
                    checked={homepage === 'landing'}
                    onChange={() => setHomepage('landing')}
                    label="Product page"
                    description="Explains what Gatekeep is, with links to the project and its docs."
                />
            </fieldset>
        </SettingsSection>
    );
}

export default function BrandingSettings() {
    return (
        <WithSettings rows={3}>
            {(settings) => (
                <div className="flex flex-col gap-6">
                    <LogoCard settings={settings} />
                    <MessageForm settings={settings} />
                    <HomepageForm settings={settings} />
                </div>
            )}
        </WithSettings>
    );
}
