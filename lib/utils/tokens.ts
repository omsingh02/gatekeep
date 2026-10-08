import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure access token
 */
export function generateAccessToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * Hashes a token for storage (using built-in crypto for speed)
 */
export async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
