/**
 * Environment variable validation and configuration
 * Validates at build time to ensure all required variables are present
 */

// Validate server-side environment variables at build time
function validateServerEnv() {
    if (typeof window !== 'undefined') return; // Skip in browser
    
    const required = {
        'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL,
        'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    
    const missing = Object.entries(required)
        .filter(([, value]) => !value)
        .map(([key]) => key);
    
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n${missing.join('\n')}\n\n` +
            `Add these to your .env.local file or Vercel environment variables.`
        );
    }
}

// Run validation on server-side during module initialization
validateServerEnv();

// Client-side environment variables (NEXT_PUBLIC_*)
// These are replaced at build time by Next.js and become string literals
export const env = {
    supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    app: {
        // Normalize application URL: default to https:// if no protocol, strip trailing slash
        url: (() => {
            const raw = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
            if (!raw) return process.env.NEXT_PUBLIC_APP_URL!;
            const withProtocol = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
            return withProtocol.replace(/\/$/, '');
        })(),
    },
} as const;

// Server-side only environment variables
// Only access these in server components, API routes, or middleware
export const serverEnv = {
    supabase: {
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
} as const;

// Type-safe environment variables
export type Env = typeof env;
export type ServerEnv = typeof serverEnv;
