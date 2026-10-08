import { randomInt } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateShortCode } from '@/lib/utils/shortCode';

/**
 * A fresh link code for a delivery. Codes are 6 base62 characters; we check both deliveries
 * and v1 file links so a new delivery never takes over an old link.
 */
export async function newDeliveryCode(): Promise<string> {
    const admin = createAdminClient();
    for (let attempt = 0; attempt < 8; attempt++) {
        const code = generateShortCode();
        const [{ data: delivery }, { data: file }] = await Promise.all([
            admin.from('deliveries').select('id').eq('short_code', code).maybeSingle(),
            admin.from('files').select('id').eq('short_code', code).maybeSingle(),
        ]);
        if (!delivery && !file) return code;
    }
    throw new Error('Could not find a free link code');
}

// No 0/O, 1/l/I: generated passwords get read out and typed by people
const READABLE = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A password people can read out and type: three groups of four, e.g. "x7Kq-mP3a-Zt9w". */
export function generateReadablePassword(): string {
    const group = () => Array.from({ length: 4 }, () => READABLE[randomInt(READABLE.length)]).join('');
    return `${group()}-${group()}-${group()}`;
}
