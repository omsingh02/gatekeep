import { createAdminClient } from '@/lib/supabase/admin';
import { emailConfigured } from '@/lib/email/transport';
import { env } from '@/lib/env';
import packageJson from '../../package.json';

/** The schema version this build of the app expects (latest migration that defines it). */
export const EXPECTED_SCHEMA_VERSION = '20261009000200';

export interface StatusCheck {
    id: 'email' | 'cron' | 'signups' | 'storage' | 'migrations' | 'owner';
    ok: boolean;
    label: string;
    detail: string;
}

async function signupsDisabled(): Promise<boolean | null> {
    try {
        const res = await fetch(`${env.supabase.url}/auth/v1/settings`, {
            headers: { apikey: env.supabase.anonKey },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const settings = (await res.json()) as { disable_signup?: boolean };
        return settings.disable_signup ?? null;
    } catch {
        return null;
    }
}

export async function systemStatus(): Promise<{ version: string; ok: boolean; checks: StatusCheck[] }> {
    const admin = createAdminClient();
    const [signups, filesBucket, brandingBucket, schema] = await Promise.all([
        signupsDisabled(),
        admin.storage.getBucket('files'),
        admin.storage.getBucket('branding'),
        admin.rpc('gatekeep_schema_version'),
    ]);

    const email = emailConfigured();
    const schemaVersion = schema.data ?? null;
    const ownerByEnv = Boolean(process.env.OWNER_EMAILS?.trim());

    const checks: StatusCheck[] = [
        {
            id: 'email',
            ok: email,
            label: email ? 'Email is set up' : "Email isn't set up",
            detail: email
                ? 'Invites, codes and notifications can be sent.'
                : 'Set RESEND_API_KEY and EMAIL_FROM to send invites, email codes and notifications. Until then, use passwords.',
        },
        {
            id: 'cron',
            ok: Boolean(process.env.CRON_SECRET),
            label: process.env.CRON_SECRET ? 'Daily job is set up' : "Daily job isn't secured",
            detail: process.env.CRON_SECRET
                ? 'Keeps the database awake, sends "access ending soon" emails and cleans up old codes.'
                : 'Set CRON_SECRET so the daily job can run.',
        },
        {
            id: 'signups',
            ok: signups === true,
            label: signups === true ? 'Sign-ups are off' : signups === false ? 'Sign-ups are on' : "Couldn't check sign-ups",
            detail:
                signups === true
                    ? 'Nobody else can create an account on your Supabase project.'
                    : 'Turn off "Allow new users to sign up" in Supabase → Authentication → Sign In / Providers. Only the owner can use Gatekeep either way.',
        },
        {
            id: 'storage',
            ok: Boolean(filesBucket.data) && Boolean(brandingBucket.data),
            label: filesBucket.data && brandingBucket.data ? 'Storage is ready' : 'Storage buckets are missing',
            detail:
                filesBucket.data && brandingBucket.data
                    ? 'The private files bucket and the branding bucket exist.'
                    : 'Run the database migrations (npx supabase db push) to create the files and branding buckets.',
        },
        {
            id: 'migrations',
            ok: schemaVersion !== null && schemaVersion >= EXPECTED_SCHEMA_VERSION,
            label: schemaVersion !== null && schemaVersion >= EXPECTED_SCHEMA_VERSION ? 'Database is up to date' : 'Database needs migrating',
            detail:
                schemaVersion !== null && schemaVersion >= EXPECTED_SCHEMA_VERSION
                    ? `Schema ${schemaVersion}.`
                    : `This version expects schema ${EXPECTED_SCHEMA_VERSION}; the database has ${schemaVersion ?? 'an older one'}. Run npx supabase db push.`,
        },
        {
            id: 'owner',
            ok: true,
            label: 'Only the owner can sign in',
            detail: ownerByEnv
                ? 'The owner is set by OWNER_EMAILS.'
                : 'The owner is the account marked by npm run create-admin.',
        },
    ];

    return { version: packageJson.version, ok: checks.every((c) => c.ok), checks };
}
