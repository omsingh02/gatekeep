'use client';

import { use, useState, type FormEvent } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button, Callout, Field, Input } from '@/components/ds';
import { AuthCard, AuthFooterLink } from '@/components/account/AuthCard';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
    const { email: initialEmail } = use(searchParams);
    const [email, setEmail] = useState(initialEmail ?? '');
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [sentTo, setSentTo] = useState<string | null>(null);

    const backToSignIn = (
        <AuthFooterLink href="/login">
            <ArrowLeft aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />
            Back to sign in
        </AuthFooterLink>
    );

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        const value = email.trim();
        if (!EMAIL.test(value)) {
            setFieldError('Enter the email address you sign in with.');
            return;
        }
        setFieldError(null);
        setSending(true);
        try {
            const res = await fetch('/api/account/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: value }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                const message = (body && typeof body.error === 'string' && body.error) || 'Something went wrong on our side. Try again in a moment.';
                if (res.status === 400) setFieldError(message);
                else setError(message);
                return;
            }
            setSentTo(value);
        } catch {
            setError("We couldn't reach Gatekeep. Check your connection and try again.");
        } finally {
            setSending(false);
        }
    };

    if (sentTo) {
        return (
            <AuthCard
                icon={MailCheck}
                title="Check your email"
                description={
                    <>
                        If <span className="font-medium text-primary">{sentTo}</span> belongs to the owner of this Gatekeep, we sent it a link
                        to reset the password. The link works once, for 1 hour.
                    </>
                }
                footer={backToSignIn}
            >
                <p className="mt-4 text-body-sm text-secondary">Nothing arrived after a few minutes? Check your spam folder, or make sure you used the email you sign in with.</p>
                <Button variant="secondary" size="lg" fullWidth className="mt-6" onClick={() => setSentTo(null)}>
                    Use a different email
                </Button>
            </AuthCard>
        );
    }

    return (
        <AuthCard
            title="Reset your password"
            description="Enter the email you sign in with. We'll send you a link to choose a new password."
            footer={backToSignIn}
        >
            <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                <Field label="Email" error={fieldError}>
                    <Input
                        size="lg"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </Field>
                {error && <Callout tone="danger">{error}</Callout>}
                <Button type="submit" variant="primary" size="lg" fullWidth loading={sending} className="mt-1">
                    {sending ? 'Sending…' : 'Send reset link'}
                </Button>
            </form>
        </AuthCard>
    );
}
