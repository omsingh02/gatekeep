import { customAlphabet } from 'nanoid';

const SHORT_CODE_LENGTH = 6;
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoidBase62 = customAlphabet(BASE62, SHORT_CODE_LENGTH);

/**
 * Generates a short, URL-safe code for file sharing
 * Uses nanoid for base62 encoding (0-9, A-Z, a-z)
 */
export function generateShortCode(): string {
    return nanoidBase62();
}

/**
 * Validates if a string is a valid short code format
 */
export function isValidShortCode(code: string): boolean {
    if (code.length !== SHORT_CODE_LENGTH) return false;
    return /^[A-Za-z0-9]+$/.test(code);
}
