'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { LogOut } from 'lucide-react';
import { Button, ConfirmDialog, Field, Input, useToast } from '@/components/ds';
import { NewPasswordFields, validateNewPassword } from '@/components/account/NewPasswordFields';
import { createClient } from '@/lib/supabase/client';
import { cleanCode } from '@/lib/auth/twoFactor';
import { readError, useDirtySection, type OwnerSettings } from '../SettingsContext';
import { SettingsSection, WithSettings } from '../SettingsShell';
import { TwoFactorSettings, useTwoFactor } from './TwoFactorSettings';

function SignInEmail({ email }: { email: string | null }) {
    return (
        <SettingsSection title="Sign-in email" description="You sign in with this address. Password reset links are sent here.">
            <Field label="Email" helper="To change it, update this user in your Supabase project (Authentication → Users).">
                <Input readOnly value={email ?? ''} className="text-secondary" />
            </Field>
        </SettingsSection>
    );
}

function ChangePassword({ twoFactorOn }: { twoFactorOn: boolean }) {
    const toast = useToast();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState({ password: '', confirm: '' });
    const [code, setCode] = useState('');
    const [errors, setErrors] = useState<{ current?: string; password?: string; confirm?: string; code?: string }>({});
    const [saving, setSaving] = useState(false);
    const dirty = Boolean(current || next.password || next.confirm);
    useDirtySection('account', dirty);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const found: typeof errors = { ...validateNewPassword(next) };
        if (!current) found.current = 'Enter your current password.';
        else if (next.password && next.password === current) found.password = 'Choose a password you haven’t used here before.';
        if (twoFactorOn && code.length !== 6) found.code = 'Enter the 6-digit code from your authenticator app.';
        setErrors(found);
        if (Object.keys(found).length) return;

        setSaving(true);
        try {
            const res = await fetch('/api/account/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: current, newPassword: next.password, ...(twoFactorOn ? { code } : {}) }),
            });
            if (!res.ok) {
                const body = await res.clone().json().catch(() => null);
                const message = await readError(res);
                if (body?.code === 'ERR_WRONG_PASSWORD') setErrors({ current: message });
                else if (body?.code === 'ERR_WRONG_CODE' || body?.code === 'ERR_CODE_REQUIRED') {
                    setErrors({ code: message });
                    setCode('');
                } else if (res.status === 400) setErrors({ password: message });
                else toast.error(message);
                return;
            }
            const { signedIn } = (await res.json().catch(() => ({}))) as { signedIn?: boolean };
            setCurrent('');
            setNext({ password: '', confirm: '' });
            setCode('');
            setErrors({});
            if (signedIn === false) {
                // Every session ended with the change and this one couldn't be renewed
                window.location.assign('/login');
                return;
            }
            toast.success('Password changed. Other browsers and devices are signed out.');
        } catch {
            toast.error("We couldn't reach Gatekeep. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection
            title="Change password"
            description="Changing it signs you out on your other browsers and devices. You'll stay signed in here."
            onSubmit={onSubmit}
            saveLabel="Change password"
            saving={saving}
            dirty={dirty}
            footerStart={
                <Link href="/forgot-password" className="rounded-sm text-caption font-medium text-secondary underline-offset-4 hover:text-primary hover:underline focus-ring">
                    Forgot your current password?
                </Link>
            }
        >
            <Field label="Current password" error={errors.current}>
                <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <NewPasswordFields values={next} onChange={setNext} errors={errors} />
            {twoFactorOn && (
                <Field label="Code from your authenticator app" helper="Two-factor sign-in is on, so changing your password takes a code too." error={errors.code}>
                    <Input
                        mono
                        value={code}
                        onChange={(e) => setCode(cleanCode(e.target.value))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        className="max-w-40 tracking-[0.2em]"
                    />
                </Field>
            )}
        </SettingsSection>
    );
}

function SignOutEverywhere() {
    const toast = useToast();
    const [open, setOpen] = useState(false);

    const signOut = async () => {
        const { error } = await createClient().auth.signOut({ scope: 'global' });
        if (error) {
            setOpen(false);
            toast.error("We couldn't sign you out everywhere. Try again in a moment.");
            return;
        }
        window.location.assign('/login');
    };

    return (
        <SettingsSection title="Signed-in devices" description="Signed in on a computer that isn't yours? Sign out of every device at once.">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-body-sm text-secondary">Signs you out on every browser and device, including this one. Recipients aren&apos;t affected.</p>
                <Button icon={<LogOut aria-hidden strokeWidth={1.75} className="h-4 w-4" />} onClick={() => setOpen(true)}>
                    Sign out everywhere
                </Button>
            </div>
            <ConfirmDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={signOut}
                title="Sign out everywhere?"
                confirmLabel="Sign out everywhere"
            >
                You&apos;ll be signed out on every browser and device, including this one, and need your password to sign in again.
            </ConfirmDialog>
        </SettingsSection>
    );
}

function AccountSections({ settings }: { settings: OwnerSettings }) {
    const twoFactor = useTwoFactor();
    return (
        <div className="flex flex-col gap-6">
            <SignInEmail email={settings.ownerEmail} />
            <ChangePassword twoFactorOn={twoFactor.state.status === 'on'} />
            <TwoFactorSettings twoFactor={twoFactor} />
            <SignOutEverywhere />
        </div>
    );
}

export default function AccountSettings() {
    return <WithSettings rows={3}>{(settings) => <AccountSections settings={settings} />}</WithSettings>;
}
