'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Button, Callout, CopyField, Dialog, Field, Input, Skeleton, StatusPill, useToast } from '@/components/ds';
import { cleanCode, codeError, codeProblem } from '@/lib/auth/twoFactor';
import { createClient } from '@/lib/supabase/client';
import { SettingsSection } from '../SettingsShell';

export type TwoFactorState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'off' } | { status: 'on'; factorId: string };

/** Whether this account has two-factor sign-in on, read from Supabase Auth (its verified factors). */
export function useTwoFactor() {
    const [state, setState] = useState<TwoFactorState>({ status: 'loading' });

    const load = useCallback(async () => {
        try {
            const { data, error } = await createClient().auth.mfa.listFactors();
            if (error) throw error;
            const verified = data.all.filter((factor) => factor.status === 'verified');
            const factor = verified.find((f) => f.factor_type === 'totp') ?? verified[0];
            setState(factor ? { status: 'on', factorId: factor.id } : { status: 'off' });
        } catch (err) {
            setState({ status: 'error', message: codeError(err, "We couldn't check two-factor sign-in. Try again in a moment.").message });
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return { state, reload: load };
}

const SETUP_FAILED = "We couldn't start setting up two-factor sign-in. Check your connection and try again.";

/** A code field: digits only, the phone keypad, and the browser's one-time-code autofill. */
function CodeInput({ value, onChange, inputRef }: { value: string; onChange: (code: string) => void; inputRef?: React.Ref<HTMLInputElement> }) {
    return (
        <Input
            ref={inputRef}
            mono
            value={value}
            onChange={(e) => onChange(cleanCode(e.target.value))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="max-w-40 tracking-[0.2em]"
        />
    );
}

interface Enrolment {
    factorId: string;
    qrCode: string;
    secret: string;
}

function StatusLine({ on, children }: { on: boolean; children: React.ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="text-body font-medium text-strong">Status</span>
                <StatusPill tone={on ? 'success' : 'neutral'}>{on ? 'On' : 'Off'}</StatusPill>
            </div>
            <p className="max-w-md text-body-sm text-secondary">{children}</p>
        </div>
    );
}

function SetUp({ enrolment, onDone, onCancel }: { enrolment: Enrolment; onDone: () => Promise<void>; onCancel: () => void }) {
    const toast = useToast();
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const confirm = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const problem = codeProblem(code);
        setError(problem);
        if (problem) return;
        setChecking(true);
        try {
            // Counts as on only once a code from the app checks out
            const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code });
            if (verifyError) throw verifyError;
            await onDone();
            toast.success('Two-factor sign-in is on. Next time you sign in, enter a code from your authenticator app after your password.');
        } catch (err) {
            const { message, wrongCode } = codeError(err);
            if (wrongCode) {
                setError(message);
                setCode('');
                input.current?.focus();
            } else {
                toast.error(message);
            }
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
                <div>
                    <p className="text-body font-medium text-strong">1. Scan this QR code with your authenticator app</p>
                    <p className="mt-0.5 text-body-sm text-secondary">For example Google Authenticator, Microsoft Authenticator, 1Password or Bitwarden.</p>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Supabase returns the QR code as an SVG data URI: dark modules, so it needs a light tile */}
                    <div className="w-fit shrink-0 rounded-md border border-default bg-gray-10 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a data URI, nothing to optimize */}
                        <img src={enrolment.qrCode} alt="QR code that adds Gatekeep to your authenticator app" width={160} height={160} className="h-40 w-40" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <p className="text-body-sm text-secondary">Can&apos;t scan it? Add an account in the app by hand and enter this setup key:</p>
                        {/* Wraps instead of cutting off: on a phone, someone typing it in needs every character */}
                        <CopyField label="Setup key" value={enrolment.secret} multiline className="break-all" />
                    </div>
                </div>
            </div>

            <form noValidate onSubmit={confirm} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                    <p className="text-body font-medium text-strong">
                        2. Enter the 6-digit code the app shows
                    </p>
                    <Field label="6-digit code" hideLabel error={error}>
                        <CodeInput value={code} onChange={setCode} inputRef={input} />
                    </Field>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" variant="primary" loading={checking}>
                        {checking ? 'Checking…' : 'Turn on two-factor sign-in'}
                    </Button>
                    <Button variant="ghost" onClick={onCancel} disabled={checking}>
                        Cancel
                    </Button>
                </div>
            </form>

            <Callout>
                Lost your phone later? Whoever manages this Gatekeep&apos;s server can turn two-factor sign-in off for your account by running{' '}
                <code className="rounded-sm border border-default bg-inset px-1 font-mono text-caption">npm run reset-two-factor</code>.
            </Callout>
        </div>
    );
}

function TurnOffDialog({ open, factorId, onClose, onDone }: { open: boolean; factorId: string; onClose: () => void; onDone: () => Promise<void> }) {
    const toast = useToast();
    const formId = useId();
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const close = () => {
        setCode('');
        setError(null);
        onClose();
    };

    const turnOff = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const problem = codeProblem(code);
        setError(problem);
        if (problem) return;
        setBusy(true);
        try {
            const supabase = createClient();
            // A fresh code first: Supabase only removes it from a session that has just entered one
            const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
            if (verifyError) throw verifyError;
            const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId });
            if (removeError) throw removeError;
            await onDone();
            close();
            toast.success('Two-factor sign-in is off. Your password alone signs you in.');
        } catch (err) {
            const { message, wrongCode } = codeError(err, "We couldn't turn off two-factor sign-in. Try again in a moment.");
            if (wrongCode) {
                setError(message);
                setCode('');
            } else {
                toast.error(message);
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            busy={busy}
            title="Turn off two-factor sign-in?"
            description="Your password alone will sign you in again. To confirm it's you, enter the code your authenticator app shows now."
            footer={
                <>
                    <Button onClick={close} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" form={formId} variant="danger-solid" loading={busy}>
                        Turn off two-factor sign-in
                    </Button>
                </>
            }
        >
            <form id={formId} noValidate onSubmit={turnOff}>
                <Field label="Code" error={error}>
                    <CodeInput value={code} onChange={setCode} />
                </Field>
            </form>
        </Dialog>
    );
}

/** Settings → Account → Two-factor sign-in: off, setting up (QR code + setup key + first code), on. */
export function TwoFactorSettings({ twoFactor }: { twoFactor: ReturnType<typeof useTwoFactor> }) {
    const toast = useToast();
    const { state, reload } = twoFactor;
    const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
    const [starting, setStarting] = useState(false);
    const [turningOff, setTurningOff] = useState(false);
    const pending = useRef<string | null>(null);

    // A setup left half-way (for example by leaving the page) is removed, so it never blocks the next one
    useEffect(
        () => () => {
            if (pending.current) void createClient().auth.mfa.unenroll({ factorId: pending.current }).catch(() => undefined);
        },
        []
    );

    const start = async () => {
        setStarting(true);
        try {
            const supabase = createClient();
            // An earlier setup that was never confirmed would get in the way of a new one
            const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
            if (listError) throw listError;
            for (const factor of factors.all.filter((f) => f.status === 'unverified')) {
                const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
                if (error) throw error;
            }
            const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Gatekeep' });
            if (error) throw error;
            pending.current = data.id;
            setEnrolment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
        } catch (err) {
            toast.error(codeError(err, SETUP_FAILED).message);
        } finally {
            setStarting(false);
        }
    };

    const cancel = () => {
        const factorId = pending.current;
        pending.current = null;
        setEnrolment(null);
        if (factorId) void createClient().auth.mfa.unenroll({ factorId }).catch(() => undefined);
    };

    const finish = async () => {
        pending.current = null;
        setEnrolment(null);
        await reload();
    };

    return (
        <div id="two-factor" className="scroll-mt-6">
            <SettingsSection
                title="Two-factor sign-in"
                description="Ask for a code from an authenticator app on your phone, as well as your password, every time you sign in."
            >
                {state.status === 'loading' && (
                    <div className="flex items-center justify-between gap-3" aria-busy="true" aria-label="Checking two-factor sign-in">
                        <div className="flex flex-col gap-1.5">
                            <Skeleton className="h-5 w-28" />
                            <Skeleton className="h-4 w-64 max-w-full" />
                        </div>
                        <Skeleton className="h-8 w-40" />
                    </div>
                )}
                {state.status === 'error' && (
                    <Callout
                        tone="danger"
                        action={
                            <Button size="sm" onClick={() => void reload()}>
                                Try again
                            </Button>
                        }
                    >
                        {state.message}
                    </Callout>
                )}
                {state.status === 'off' && !enrolment && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <StatusLine on={false}>Anyone who learns your password can sign in. With two-factor sign-in, they&apos;d also need your phone.</StatusLine>
                        <Button icon={<ShieldCheck aria-hidden strokeWidth={1.75} className="h-4 w-4" />} loading={starting} onClick={start}>
                            Set up two-factor sign-in
                        </Button>
                    </div>
                )}
                {state.status === 'off' && enrolment && <SetUp enrolment={enrolment} onDone={finish} onCancel={cancel} />}
                {state.status === 'on' && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <StatusLine on>Signing in takes your password and a code from your authenticator app.</StatusLine>
                        <Button variant="danger" icon={<ShieldOff aria-hidden strokeWidth={1.75} className="h-4 w-4" />} onClick={() => setTurningOff(true)}>
                            Turn off two-factor sign-in
                        </Button>
                        <TurnOffDialog open={turningOff} factorId={state.factorId} onClose={() => setTurningOff(false)} onDone={reload} />
                    </div>
                )}
            </SettingsSection>
        </div>
    );
}
