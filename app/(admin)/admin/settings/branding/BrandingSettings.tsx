'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { Avatar, Button, Card, Field, Input, Textarea, cn, useToast } from '@/components/ds';
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
        <SettingsSection title="Logo" description="Shown at the top of your delivery pages, above your name.">
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

function RecipientPreview({ settings, message }: { settings: OwnerSettings; message: string }) {
    const sender = senderPreview(settings.displayName ?? '', settings.organization ?? '', settings.ownerEmail);
    return (
        <div className="rounded-lg border border-subtle bg-canvas px-4 py-8 sm:px-8" aria-label="Preview of a delivery page" role="img">
            <Card className="mx-auto w-full max-w-card">
                <div className="flex flex-col items-center text-center">
                    {settings.logoUrl ? (
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-default bg-inset">
                            <LogoImage src={settings.logoUrl} className="h-full w-full p-1" />
                        </div>
                    ) : (
                        <Avatar name={sender} />
                    )}
                    <p className="mt-3 text-h3 text-strong">{sender} sent you files</p>
                    {message.trim() ? (
                        <p className="mt-2 whitespace-pre-line break-words text-body-sm text-secondary">{message.trim()}</p>
                    ) : (
                        <p className="mt-2 text-body-sm text-tertiary">Your message to recipients appears here.</p>
                    )}
                </div>
                <div className="mt-5 flex flex-col gap-1.5">
                    <span className="text-caption font-medium text-secondary">Your email</span>
                    <Input size="lg" readOnly tabIndex={-1} placeholder="name@company.com" aria-hidden />
                </div>
                <Button variant="primary" size="lg" fullWidth className="pointer-events-none mt-3" tabIndex={-1} aria-hidden>
                    Send me a code
                </Button>
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

export default function BrandingSettings() {
    return (
        <WithSettings rows={3}>
            {(settings) => (
                <div className="flex flex-col gap-6">
                    <LogoCard settings={settings} />
                    <MessageForm settings={settings} />
                </div>
            )}
        </WithSettings>
    );
}
