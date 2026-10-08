import { execSync } from 'node:child_process';

/**
 * URL and keys of the local Supabase stack (`npx supabase start`). These are the
 * well-known local development keys, not secrets. Values already in the
 * environment win, so CI or a custom stack can override them.
 */
export function localSupabaseEnv() {
    let status: Record<string, string> = {};
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        // CI installs the `supabase` binary; locally `npx supabase` works without a global install
        for (const cli of ['supabase', 'npx supabase']) {
            try {
                const out = execSync(`${cli} status -o env`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
                status = Object.fromEntries([...out.matchAll(/^([A-Z_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]));
                break;
            } catch {
                // try the next way of running the CLI
            }
        }
        if (!status.API_URL) {
            throw new Error('Local Supabase is not running. Start it with `npx supabase start` (see CONTRIBUTING.md).');
        }
    }
    const env = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || status.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || status.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || status.SERVICE_ROLE_KEY,
    };
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
        // The global setup wipes and reseeds the demo admin — never point it at a real project
        throw new Error(`Refusing to run e2e tests against a non-local Supabase: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
    }
    return env as Record<keyof typeof env, string>;
}
