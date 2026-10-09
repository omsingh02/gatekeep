import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 (the setup key an authenticator app is given), padding and spaces ignored. */
export function base32Decode(input: string): Buffer {
    const clean = input.toUpperCase().replace(/[\s=]/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of clean) {
        const index = BASE32.indexOf(char);
        if (index === -1) throw new Error(`Not base32: ${char}`);
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/**
 * The code an authenticator app shows: RFC 6238 TOTP with HMAC-SHA-1, 30-second steps and 6 digits,
 * which is what Supabase Auth checks. `key` is the raw secret; use totp() for a base32 setup key.
 */
export function totpFromKey(key: Buffer, atMs = Date.now(), digits = 6): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));
    const hmac = createHmac('sha1', key).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
    return String(binary % 10 ** digits).padStart(digits, '0');
}

export function totp(secret: string, atMs = Date.now()): string {
    return totpFromKey(base32Decode(secret), atMs);
}

/** A 6-digit code that is not valid around now (Supabase also accepts the previous and next step). */
export function wrongTotp(secret: string): string {
    const valid = new Set([-30_000, 0, 30_000].map((shift) => totp(secret, Date.now() + shift)));
    for (let n = 0; ; n++) {
        const candidate = String((123_456 + n * 111_111) % 1_000_000).padStart(6, '0');
        if (!valid.has(candidate)) return candidate;
    }
}
