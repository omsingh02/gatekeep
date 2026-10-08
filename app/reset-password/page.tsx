'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Link2Off } from 'lucide-react';
import { Button, Callout, Skeleton } from '@/components/ds';
import { AuthCard, AuthFooterLink } from '@/components/account/AuthCard';
import { NewPasswordFields, validateNewPassword } from '@/components/account/NewPasswordFields';
import { createClient } from '@/lib/supabase/client';

type State = 'checking' | 'ready' | 'invalid' | 'done';

/** Set after a reset link is verified, so a reload of this page keeps the form instead of "link expired". */
const RECOVERY_FLAG = 'gatekeep-password-recovery';

/**
 * Turn the recovery link into a session. Gatekeep's reset email links here with `token_hash`
 * (verified with verifyOtp); Supabase's own redirects use `#access_token=…` (implicit) or
 * `?code=…` (PKCE). Any `error_code` in the URL means the link is expired or already used.
 */
async function startRecovery(): Promise<boolean> {
    const supabase = createClient();
    const url = new URL(window.location.href);
    const query = url.searchParams;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const clearUrl = () => window.history.replaceState(null, '', url.pathname);

    if (query.get('error') || query.get('error_code') || hash.get('error') || hash.get('error_code')) {
        clearUrl();
        return false;
    }

    const tokenHash = query.get('token_hash');
    if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        clearUrl();
        return !error;
    }

    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        clearUrl();
        return !error;
    }

    const code = query.get('code');
    if (code) {
        // The browser client may already have exchanged it while starting up
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            clearUrl();
            return true;
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        clearUrl();
        return !error;
    }

    // No token: only continue a recovery this tab already verified (e.g. after a reload)
    if (window.sessionStorage.getItem(RECOVERY_FLAG) === '1') {
        const { data } = await supabase.auth.getUser();
        return Boolean(data.user);
    }
    return false;
}

function updateError(err: { code?: string; message?: string }): { field?: string; form?: string; expired?: boolean } {
    if (err.code === 'same_password') return { field: 'Choose a password you haven’t used here before.' };
    if (err.code === 'weak_password') return { field: 'Choose a longer password, with a few unrelated words.' };
    if (err.code === 'session_not_found' || err.code === 'session_expired' || err.code === 'bad_jwt') return { expired: true };
    if (err.code === 'over_request_rate_limit') return { form: 'Too many tries. Wait a few minutes, then try again.' };
    return { form: "We couldn't change your password. Try again in a moment." };
}

export default function ResetPasswordPage() {
    const [state, setState] = useState<State>('checking');
    const [values, setValues] = useState({ password: '', confirm: '' });
    const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const started = useRef(false);
    const router = useRouter();

    useEffect(() => {
        // Tokens work once: never verify twice (React may run effects twice in development)
        if (started.current) return;
        started.current = true;
        startRecovery()
            .then((ok) => {
                if (ok) window.sessionStorage.setItem(RECOVERY_FLAG, '1');
                setState(ok ? 'ready' : 'invalid');
            })
            .catch(() => setState('invalid'));
    }, []);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);
        const found = validateNewPassword(values);
        setErrors(found);
        if (Object.keys(found).length) return;

        setSaving(true);
        try {
            const { error } = await createClient().auth.updateUser({ password: values.password });
            if (error) {
                const mapped = updateError(error);
                if (mapped.expired) {
                    window.sessionStorage.removeItem(RECOVERY_FLAG);
                    setState('invalid');
                } else if (mapped.field) setErrors({ password: mapped.field });
                else setFormError(mapped.form ?? null);
                return;
            }
            window.sessionStorage.removeItem(RECOVERY_FLAG);
            setState('done');
        } catch {
            setFormError("We couldn't reach Gatekeep. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const backToSignIn = (
        <AuthFooterLink href="/login">
            <ArrowLeft aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />
            Back to sign in
        </AuthFooterLink>
    );

    if (state === 'checking') {
        return (
            <AuthCard title="Choose a new password" description="Checking your reset link…">
                <div className="mt-6 flex flex-col gap-4" aria-hidden>
                    {[0, 1].map((i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                    <Skeleton className="mt-1 h-10 w-full" />
                </div>
            </AuthCard>
        );
    }

    if (state === 'invalid') {
        return (
            <AuthCard
                icon={Link2Off}
                title="This reset link doesn't work anymore"
                description="Reset links work once and expire after 1 hour. Ask for a new one and use the link in the latest email."
                footer={backToSignIn}
            >
                <Button variant="primary" size="lg" fullWidth className="mt-6" onClick={() => router.push('/forgot-password')}>
                    Send a new link
                </Button>
            </AuthCard>
        );
    }

    if (state === 'done') {
        return (
            <AuthCard
                icon={CheckCircle2}
                iconClassName="h-5 w-5 text-success"
                title="Password changed"
                description="You're signed in. Use your new password next time you sign in."
            >
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    className="mt-6"
                    onClick={() => {
                        router.push('/admin');
                        router.refresh();
                    }}
                >
                    Go to the dashboard
                </Button>
            </AuthCard>
        );
    }

    return (
        <AuthCard title="Choose a new password" description="Choose one you don't use anywhere else. You'll stay signed in on this browser." footer={backToSignIn}>
            <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                <NewPasswordFields size="lg" values={values} onChange={setValues} errors={errors} />
                {formError && <Callout tone="danger">{formError}</Callout>}
                <Button type="submit" variant="primary" size="lg" fullWidth loading={saving} className="mt-1">
                    {saving ? 'Saving…' : 'Set new password'}
                </Button>
            </form>
        </AuthCard>
    );
}
