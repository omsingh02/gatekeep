import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/types';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
/** At most this many codes per recipient within RESEND_WINDOW_MS. */
export const RESEND_MAX = 3;
export const RESEND_WINDOW_MS = 10 * 60 * 1000;

export function generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Codes are stored hashed and bound to the recipient, so a leaked hash is useless elsewhere. */
export function hashCode(code: string, recipientId: string): string {
    return createHash('sha256').update(`gatekeep-code:${recipientId}:${code}`).digest('hex');
}

/** Whether another code may be sent, given when the recent ones were created. */
export function canSendAnotherCode(recentCreatedAt: (string | Date)[], now = Date.now()): boolean {
    const inWindow = recentCreatedAt.filter((t) => now - new Date(t).getTime() < RESEND_WINDOW_MS);
    return inWindow.length < RESEND_MAX;
}

export type CodeCheck = 'ok' | 'wrong' | 'expired' | 'too_many';

type CodeRow = Pick<Tables<'verification_codes'>, 'code_hash' | 'expires_at' | 'attempts' | 'consumed_at'>;

/** Pure decision for a submitted code against the latest code row. Exported for tests. */
export function evaluateCode(row: CodeRow | null, submitted: string, recipientId: string, now = Date.now()): CodeCheck {
    if (!row || row.consumed_at) return 'expired';
    if (new Date(row.expires_at).getTime() <= now) return 'expired';
    if (row.attempts >= CODE_MAX_ATTEMPTS) return 'too_many';
    const expected = Buffer.from(row.code_hash, 'hex');
    const actual = Buffer.from(hashCode(submitted.replace(/\D/g, ''), recipientId), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? 'ok' : 'wrong';
}

/** Create a code for a recipient, unless they've had too many recently. Returns the code or null. */
export async function issueCode(recipientId: string): Promise<string | null> {
    const admin = createAdminClient();
    const since = new Date(Date.now() - RESEND_WINDOW_MS).toISOString();
    const { data: recent } = await admin
        .from('verification_codes')
        .select('created_at')
        .eq('recipient_id', recipientId)
        .gte('created_at', since);
    if (!canSendAnotherCode((recent ?? []).map((r) => r.created_at))) return null;

    const code = generateCode();
    // A new code replaces any earlier one that's still open
    await admin
        .from('verification_codes')
        .update({ consumed_at: new Date().toISOString() })
        .eq('recipient_id', recipientId)
        .is('consumed_at', null);
    const { error } = await admin.from('verification_codes').insert({
        recipient_id: recipientId,
        code_hash: hashCode(code, recipientId),
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (error) throw error;
    return code;
}

/** Check a submitted code; counts the attempt and consumes the code on success. */
export async function checkCode(recipientId: string, submitted: string): Promise<CodeCheck> {
    const admin = createAdminClient();
    const { data: row } = await admin
        .from('verification_codes')
        .select('*')
        .eq('recipient_id', recipientId)
        .is('consumed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const result = evaluateCode(row, submitted, recipientId);
    if (!row) return result;
    if (result === 'ok') {
        await admin.from('verification_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
    } else if (result === 'wrong') {
        await admin.from('verification_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    }
    return result;
}

/** Spend the same time as a real check when there's no recipient to check against. */
export function checkCodeAgainstNothing(submitted: string): 'wrong' {
    hashCode(submitted, '00000000-0000-0000-0000-000000000000');
    return 'wrong';
}

/** Remove codes that can no longer be used (daily cron). Returns how many were removed. */
export async function purgeOldCodes(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data } = await createAdminClient()
        .from('verification_codes')
        .delete()
        .lt('expires_at', cutoff)
        .select('id');
    return data?.length ?? 0;
}
