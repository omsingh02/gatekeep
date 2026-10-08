import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Generates a cryptographically secure random password
 */
let dummyHash: Promise<string> | null = null;

/**
 * Spend the same time as a real password check when there is nothing to check against
 * (unknown recipient), so response timing doesn't reveal who has access.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
    dummyHash ??= hashPassword('gatekeep-timing-equaliser');
    await verifyPassword(password, await dummyHash);
    return false;
}

export function generateRandomPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const charsetLength = charset.length;
    let password = '';
    
    // Use crypto.getRandomValues for cryptographically secure randomness
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
        password += charset.charAt(randomValues[i] % charsetLength);
    }
    return password;
}
