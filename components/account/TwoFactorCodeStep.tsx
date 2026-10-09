'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { Button, Callout, Field, Input } from '@/components/ds';
import { AuthCard, AuthFooterButton } from '@/components/account/AuthCard';
import { cleanCode, codeError, codeProblem } from '@/lib/auth/twoFactor';
import { createClient } from '@/lib/supabase/client';

export interface TwoFactorCodeStepProps {
    description?: ReactNode;
    submitLabel?: string;
    /** The code was right: this browser is now fully signed in */
    onVerified: () => void;
    /** "Use a different account": this browser has been signed out */
    onSignedOut: () => void;
}

/**
 * The second sign-in step for an account with two-factor sign-in: a 6-digit code from the
 * authenticator app. Used after the password on /login and after a reset link on /reset-password.
 */
export function TwoFactorCodeStep({
    description = 'Enter the 6-digit code from your authenticator app.',
    submitLabel = 'Sign in',
    onVerified,
    onSignedOut,
}: TwoFactorCodeStepProps) {
    const [code, setCode] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);
        const problem = codeProblem(code);
        setFieldError(problem);
        if (problem) return;

        setChecking(true);
        try {
            const supabase = createClient();
            const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
            if (listError) throw listError;
            const factor = factors.totp[0];
            // Turned off in the meantime (for example with npm run reset-two-factor): nothing left to check
            if (factor) {
                const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
                if (error) throw error;
            }
            onVerified();
        } catch (err) {
            const { message, wrongCode } = codeError(err);
            if (wrongCode) {
                setFieldError(message);
                setCode('');
                input.current?.focus();
            } else {
                setFormError(message);
            }
            setChecking(false);
        }
    };

    const useDifferentAccount = async () => {
        setLeaving(true);
        // Only this browser: the default ("global") would sign the account out everywhere
        await createClient()
            .auth.signOut({ scope: 'local' })
            .catch(() => undefined);
        setLeaving(false);
        onSignedOut();
    };

    return (
        <AuthCard
            icon={Smartphone}
            title="Two-factor sign-in"
            description={description}
            footer={
                <AuthFooterButton onClick={useDifferentAccount} disabled={leaving}>
                    <ArrowLeft aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />
                    Use a different account
                </AuthFooterButton>
            }
        >
            <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                <Field label="Code" error={fieldError}>
                    <Input
                        ref={input}
                        size="lg"
                        mono
                        value={code}
                        onChange={(e) => setCode(cleanCode(e.target.value))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        placeholder="123456"
                        className="tracking-[0.2em]"
                    />
                </Field>

                {formError && <Callout tone="danger">{formError}</Callout>}

                <Button type="submit" variant="primary" size="lg" fullWidth loading={checking} className="mt-1">
                    {checking ? 'Checking…' : submitLabel}
                </Button>
            </form>
            <p className="mt-5 text-caption text-tertiary">
                Lost your phone? Whoever manages this Gatekeep&apos;s server can turn two-factor sign-in off for your account.
            </p>
        </AuthCard>
    );
}
