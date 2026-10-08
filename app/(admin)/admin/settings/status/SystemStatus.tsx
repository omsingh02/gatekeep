'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Badge, Button, Callout, Card, CardHeader, Skeleton, StatusPill } from '@/components/ds';
import type { ReactNode } from 'react';
import { DOCS_URL, readError } from '../SettingsContext';

/** GET /api/status (lib/deliveries/status.ts) */
interface StatusCheck {
    id: 'email' | 'cron' | 'signups' | 'storage' | 'migrations' | 'owner';
    ok: boolean;
    label: string;
    detail: string;
}

interface StatusResponse {
    version: string;
    ok: boolean;
    checks: StatusCheck[];
}

type Severity = 'ok' | 'warning' | 'error';

/** Gatekeep still works without these (warning); it doesn't without the others (error). */
const SOFT: StatusCheck['id'][] = ['email', 'cron', 'signups'];

/** What to change, verbatim, for checks that fail. */
const FIXES: Partial<Record<StatusCheck['id'], { lead: string; code: string[] }>> = {
    email: { lead: 'Environment variables', code: ['RESEND_API_KEY', 'EMAIL_FROM'] },
    cron: { lead: 'Environment variable', code: ['CRON_SECRET'] },
    signups: { lead: 'Supabase setting', code: ['Allow new users to sign up: off'] },
    storage: { lead: 'Run', code: ['npx supabase db push'] },
    migrations: { lead: 'Run', code: ['npx supabase db push'] },
};

function severity(check: StatusCheck): Severity {
    if (check.ok) return 'ok';
    return SOFT.includes(check.id) ? 'warning' : 'error';
}

const PILL: Record<Severity, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
    ok: { tone: 'success', label: 'OK' },
    warning: { tone: 'warning', label: 'Warning' },
    error: { tone: 'danger', label: 'Error' },
};

function Row({ title, detail, aside, fix }: { title: string; detail: string; aside: ReactNode; fix?: { lead: string; code: string[] } }) {
    return (
        <li className="flex flex-col gap-1 border-b border-subtle px-4 py-3.5 last:border-b-0 sm:px-5" data-testid="status-row">
            <div className="flex items-start justify-between gap-3">
                <span className="text-body font-medium text-strong">{title}</span>
                {aside}
            </div>
            <p className="max-w-2xl text-body-sm text-secondary">{detail}</p>
            {fix && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-tertiary">
                    <span>{fix.lead}:</span>
                    {fix.code.map((code) => (
                        <code key={code} className="rounded-sm border border-default bg-inset px-1.5 py-0.5 font-mono text-caption text-primary">
                            {code}
                        </code>
                    ))}
                </p>
            )}
        </li>
    );
}

export default function SystemStatus() {
    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/status', { cache: 'no-store' });
            if (!res.ok) throw new Error(await readError(res));
            setStatus((await res.json()) as StatusResponse);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "We couldn't check the setup. Try again.");
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/status', { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error(await readError(res));
                return (await res.json()) as StatusResponse;
            })
            .then((data) => !cancelled && setStatus(data))
            .catch((err: Error) => !cancelled && setError(err.message))
            .finally(() => !cancelled && setChecking(false));
        return () => {
            cancelled = true;
        };
    }, []);

    const checks = status?.checks ?? [];
    const errors = checks.filter((c) => severity(c) === 'error').length;
    const warnings = checks.filter((c) => severity(c) === 'warning').length;
    const attention = errors + warnings;

    return (
        <div className="flex flex-col gap-6">
            {status && (
                <Callout
                    tone={errors ? 'danger' : warnings ? 'warning' : 'success'}
                    title={attention === 0 ? 'Everything is set up' : attention === 1 ? '1 thing needs attention' : `${attention} things need attention`}
                >
                    {attention === 0
                        ? 'Email, the daily job, storage and the database are ready.'
                        : 'Each item below says what to change. After changing environment variables, redeploy.'}
                </Callout>
            )}
            {error && !checking && (
                <Callout tone="danger" title="We couldn't check the setup">
                    {error}
                </Callout>
            )}
            <Card flush>
                <CardHeader
                    title="System status"
                    description="What this Gatekeep needs to run well, checked just now."
                    actions={
                        <Button
                            size="sm"
                            icon={<RefreshCw aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />}
                            loading={checking}
                            onClick={() => {
                                setChecking(true);
                                void load();
                            }}
                        >
                            Check again
                        </Button>
                    }
                />
                {!status ? (
                    <ul aria-busy={checking} aria-label="Checking the setup">
                        {Array.from({ length: 6 }, (_, i) => (
                            <li key={i} className="flex flex-col gap-2 border-b border-subtle px-4 py-3.5 last:border-b-0 sm:px-5">
                                <div className="flex justify-between gap-3">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-5 w-12" />
                                </div>
                                <Skeleton className="h-4 w-3/4" />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <ul>
                        {checks.map((check) => {
                            const level = severity(check);
                            return (
                                <Row
                                    key={check.id}
                                    title={check.label}
                                    detail={check.detail}
                                    aside={<StatusPill tone={PILL[level].tone}>{PILL[level].label}</StatusPill>}
                                    fix={level === 'ok' ? undefined : FIXES[check.id]}
                                />
                            );
                        })}
                        <Row title="Version" detail="The version of Gatekeep that's running. Compare it with the latest release before upgrading." aside={<Badge className="font-mono">{status.version}</Badge>} />
                    </ul>
                )}
            </Card>
            <p className="text-body-sm text-secondary">
                Setting up or moving Gatekeep? The{' '}
                <a
                    href={`${DOCS_URL}/DEPLOYMENT.md`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline underline-offset-4 hover:text-strong focus-ring"
                >
                    deployment guide
                    <ExternalLink aria-hidden strokeWidth={1.75} className="h-3 w-3" />
                </a>{' '}
                covers every setting on this page.
            </p>
        </div>
    );
}
