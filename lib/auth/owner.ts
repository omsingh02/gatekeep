import type { User } from '@supabase/supabase-js';

/**
 * Only the instance owner may use the dashboard and admin APIs. A signed-in Supabase user is
 * not enough: if sign-ups are ever enabled on the project, anyone could otherwise create an
 * account and use this instance's storage.
 *
 * An account is the owner when either:
 * - its app_metadata.role is "owner" (set by `npm run create-admin`; users can't change app_metadata), or
 * - its email is listed in OWNER_EMAILS (comma-separated), for existing installs.
 */
export function isOwner(user: User | null | undefined): boolean {
    if (!user) return false;
    if (user.app_metadata?.role === 'owner') return true;

    const allowed = (process.env.OWNER_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    return Boolean(user.email) && allowed.includes(user.email!.toLowerCase());
}
