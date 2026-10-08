'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button, Callout, Card, Field, IconButton, Input } from '@/components/ds';
import { recipientApi, type AccessOptions, type Failure, type PublicSender, type VerifiedView } from './api';
import { CardPage, SenderBlock } from './Shell';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
const RESEND_SECONDS = [30, 60, 120];

type Mode = 'email' | 'code' | 'password';

export interface SignInProps {
    code: string;
    kind: 'send' | 'request';
    sender: PublicSender;
    access: AccessOptions;
    /** Why they're seeing this again (session ended elsewhere, signed out) */
    notice?: string | null;
    onSignedIn: (view: VerifiedView) => void;
    /** Credentials matched but access can't continue (ended) */
    onBlocked: (failure: Failure) => void;
}

export function SignIn({ code, kind, sender, access, notice, onSignedIn, onBlocked }: SignInProps) {
    const hasPasswordWay = access.password || access.anyone;
    const [mode, setMode] = useState<Mode>(access.emailCode || !hasPasswordWay ? 'email' : 'password');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; otp?: string; identifier?: string; password?: string }>({});
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [resends, setResends] = useState(0);

    const emailRef = useRef<HTMLInputElement>(null);
    const otpRef = useRef<HTMLInputElement>(null);
    const identifierRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const lastAutoSubmit = useRef('');

    // Only "anyone with the password" (no named password people): just the password
    const askIdentifier = access.password;
    const identifierOptional = access.password && access.anyone;

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Move focus to the first field of each step
    useEffect(() => {
        const target = mode === 'email' ? emailRef : mode === 'code' ? otpRef : askIdentifier ? identifierRef : passwordRef;
        target.current?.focus();
    }, [mode, askIdentifier]);

    const switchMode = (next: Mode) => {
        setErrors({});
        setStatus('');
        setMode(next);
    };

    const sendCode = async (isResend = false) => {
        const value = email.trim();
        if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            setErrors({ email: 'Enter the email address the invite was sent to.' });
            emailRef.current?.focus();
            return;
        }
        setBusy(true);
        setErrors({});
        const result = await recipientApi.requestCode(code, value);
        setBusy(false);
        if ('failure' in result) {
            if (isResend) setErrors({ otp: result.failure.message });
            else setErrors({ email: result.failure.message });
            return;
        }
        const nextResends = isResend ? resends + 1 : 0;
        setResends(nextResends);
        setCooldown(RESEND_SECONDS[Math.min(nextResends, RESEND_SECONDS.length - 1)]);
        setStatus(
            isResend
                ? `We sent another code. If ${value} has access, it arrives in a moment. It expires in 10 minutes.`
                : `If ${value} has access, we sent a code. It expires in 10 minutes.`,
        );
        setOtp('');
        lastAutoSubmit.current = '';
        if (!isResend) setMode('code');
        else otpRef.current?.focus();
    };

    const verifyCode = async (value = otp) => {
        if (value.length !== 6) {
            setErrors({ otp: 'Enter the 6-digit code from the email.' });
            otpRef.current?.focus();
            return;
        }
        setBusy(true);
        setErrors({});
        const result = await recipientApi.signIn(code, { email: email.trim(), code: value });
        setBusy(false);
        if ('data' in result) return onSignedIn(result.data);
        if (result.failure.kind === 'ended' || result.failure.kind === 'removed') return onBlocked(result.failure);
        setErrors({ otp: result.failure.message });
        otpRef.current?.select();
    };

    const unlock = async () => {
        const id = identifier.trim();
        if (askIdentifier && !identifierOptional && !id) {
            setErrors({ identifier: 'Enter the email or username you were given.' });
            identifierRef.current?.focus();
            return;
        }
        if (!password) {
            setErrors({ password: 'Enter your password.' });
            passwordRef.current?.focus();
            return;
        }
        setBusy(true);
        setErrors({});
        const result = await recipientApi.signIn(code, id ? { identifier: id, password } : { password });
        setBusy(false);
        if ('data' in result) return onSignedIn(result.data);
        if (result.failure.kind === 'ended' || result.failure.kind === 'removed') return onBlocked(result.failure);
        setErrors({ password: result.failure.message });
        passwordRef.current?.select();
    };

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        if (mode === 'email') void sendCode();
        else if (mode === 'code') void verifyCode();
        else void unlock();
    };

    const onOtpChange = (raw: string) => {
        // Accept pasted text like "123 456" or "Your code: 123456"
        const digits = raw.replace(/\D/g, '').slice(0, 6);
        setOtp(digits);
        if (errors.otp) setErrors({});
        if (digits.length === 6 && lastAutoSubmit.current !== digits && !busy) {
            lastAutoSubmit.current = digits;
            void verifyCode(digits);
        }
    };

    const verb = kind === 'request' ? 'asked you for files' : 'sent you files';
    const intro =
        mode === 'email'
            ? `Enter your email address and we'll send you a code to ${kind === 'request' ? 'continue' : 'open them'}.`
            : mode === 'code'
              ? 'Enter the 6-digit code from the email.'
              : askIdentifier
                ? `Enter the details ${sender.name} gave you.`
                : `Enter the password ${sender.name} gave you.`;

    return (
        <CardPage>
            <Card className="flex flex-col gap-6 p-6 sm:p-6">
                <SenderBlock sender={sender} />

                <div className="flex flex-col gap-1.5">
                    <h1 className="text-h2 text-strong">
                        {sender.name} {verb}
                    </h1>
                    <p className="text-body text-secondary">{intro}</p>
                </div>

                {sender.message && mode !== 'code' && (
                    <blockquote className="whitespace-pre-line border-l-2 border-default pl-3 text-body-sm text-secondary">
                        {sender.message}
                    </blockquote>
                )}

                {notice && <Callout>{notice}</Callout>}

                <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
                    {mode === 'email' && (
                        <>
                            <Field label="Email" error={errors.email}>
                                <Input
                                    ref={emailRef}
                                    size="lg"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errors.email) setErrors({});
                                    }}
                                />
                            </Field>
                            <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} icon={<Mail {...ICON} />}>
                                Send code
                            </Button>
                        </>
                    )}

                    <p role="status" aria-live="polite" className={mode === 'code' && status ? 'text-body-sm text-primary' : 'sr-only'}>
                        {mode === 'code' ? status : ''}
                    </p>

                    {mode === 'code' && (
                        <>
                            <Field label="Code" error={errors.otp}>
                                <Input
                                    ref={otpRef}
                                    size="lg"
                                    mono
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]*"
                                    placeholder="000000"
                                    className="text-center text-h2 tracking-[0.4em] selection:bg-gray-6 selection:text-strong"
                                    value={otp}
                                    onChange={(e) => onOtpChange(e.target.value)}
                                />
                            </Field>
                            <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>
                                Open delivery
                            </Button>
                            <div className="flex flex-wrap items-center justify-between gap-x-4">
                                <Button
                                    variant="link"
                                    className="min-h-10 text-body-sm tabular-nums"
                                    disabled={cooldown > 0 || busy}
                                    onClick={() => void sendCode(true)}
                                >
                                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                                </Button>
                                <Button
                                    variant="link"
                                    className="min-h-10 text-body-sm"
                                    disabled={busy}
                                    onClick={() => {
                                        setOtp('');
                                        switchMode('email');
                                    }}
                                >
                                    Use a different email
                                </Button>
                            </div>
                        </>
                    )}

                    {mode === 'password' && (
                        <>
                            {askIdentifier && (
                                <Field
                                    label="Email or username"
                                    helper={identifierOptional ? 'Optional. Leave it empty if you were only given a password.' : undefined}
                                    error={errors.identifier}
                                >
                                    <Input
                                        ref={identifierRef}
                                        size="lg"
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        value={identifier}
                                        onChange={(e) => {
                                            setIdentifier(e.target.value);
                                            if (errors.identifier) setErrors({});
                                        }}
                                    />
                                </Field>
                            )}
                            <Field label="Password" error={errors.password}>
                                <Input
                                    ref={passwordRef}
                                    size="lg"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (errors.password) setErrors({});
                                    }}
                                    trailing={
                                        <IconButton
                                            label={showPassword ? 'Hide password' : 'Show password'}
                                            icon={showPassword ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                                            onClick={() => setShowPassword((v) => !v)}
                                        />
                                    }
                                />
                            </Field>
                            <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>
                                Unlock delivery
                            </Button>
                        </>
                    )}
                </form>

                {mode === 'email' && hasPasswordWay && (
                    <Button variant="link" className="min-h-10 self-center text-body" onClick={() => switchMode('password')}>
                        I have a password
                    </Button>
                )}
                {mode === 'password' && access.emailCode && (
                    <Button variant="link" className="min-h-10 self-center text-body" onClick={() => switchMode('email')}>
                        Email me a code instead
                    </Button>
                )}

                <p className="flex items-start gap-2 border-t border-subtle pt-4 text-caption text-tertiary">
                    <Lock {...ICON} className="mt-px h-3.5 w-3.5 shrink-0" />
                    {access.emailCode || access.password
                        ? `Only people ${sender.name} added can open this delivery.`
                        : `Only people with the password can open this delivery.`}
                </p>
            </Card>
        </CardPage>
    );
}
