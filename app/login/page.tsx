'use client';

import Link from 'next/link';
import { use, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Callout, Field, Input } from '@/components/ds';
import { AuthCard, AuthFooterLink } from '@/components/account/AuthCard';
import { createClient } from '@/lib/supabase/client';

/** Supabase's messages are for developers; say what happened and what to do instead. */
function signInError(err: unknown): string {
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 0;
    if (code === 'invalid_credentials' || status === 400) return "That email and password don't match. Check them and try again.";
    if (code === 'over_request_rate_limit' || status === 429) return 'Too many tries. Wait a few minutes, then try again.';
    if (code === 'email_not_confirmed') return "This account's email address isn't confirmed yet.";
    return "We couldn't sign you in. Check your connection and try again.";
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
    const { reason } = use(searchParams);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        const found: typeof errors = {};
        if (!email.trim()) found.email = 'Enter your email address.';
        if (!password) found.password = 'Enter your password.';
        setErrors(found);
        if (Object.keys(found).length) return;

        setIsLoading(true);
        try {
            const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
            if (error) throw error;
            router.push('/admin');
            router.refresh();
        } catch (err) {
            setError(signInError(err));
            setIsLoading(false);
        }
    };

    const forgotHref = email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password';

    return (
        <AuthCard
            title="Sign in to Gatekeep"
            description="Use the owner account for this Gatekeep."
            footer={
                <AuthFooterLink href="/">
                    <ArrowLeft aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />
                    Back to home
                </AuthFooterLink>
            }
        >
            {reason === 'not-owner' && (
                <Callout tone="warning" className="mt-5">
                    That account isn&apos;t the owner of this Gatekeep. Sign in with the owner account.
                </Callout>
            )}

            <form noValidate onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
                <Field label="Email" error={errors.email}>
                    <Input
                        size="lg"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        autoFocus
                        placeholder="you@example.com"
                    />
                </Field>
                <Field
                    label="Password"
                    error={errors.password}
                    labelAction={
                        <Link href={forgotHref} className="rounded-sm text-caption font-medium text-secondary underline-offset-4 hover:text-primary hover:underline focus-ring">
                            Forgot password?
                        </Link>
                    }
                >
                    <Input size="lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </Field>

                {error && <Callout tone="danger">{error}</Callout>}

                <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading} className="mt-1">
                    {isLoading ? 'Signing in…' : 'Sign in'}
                </Button>
            </form>
        </AuthCard>
    );
}
