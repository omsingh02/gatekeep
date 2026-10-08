/**
 * Input sanitization utilities to prevent XSS and injection attacks
 */

/**
 * Sanitize filename to prevent XSS and path traversal attacks
 * - Removes null bytes
 * - Removes path traversal sequences
 * - Removes control characters
 * - Limits length
 * - Preserves safe characters: alphanumeric, spaces, dots, hyphens, underscores
 */
export function sanitizeFilename(filename: string, maxLength: number = 255): string {
    if (!filename || typeof filename !== 'string') {
        return 'unnamed';
    }

    let sanitized = filename
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove path traversal attempts
        .replace(/\.\./g, '')
        .replace(/[\/\\]/g, '')
        // Remove control characters (0x00-0x1f, 0x7f-0x9f)
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
        // Remove potentially dangerous characters
        .replace(/[<>:"|?*]/g, '')
        // Collapse multiple spaces/dots to single
        .replace(/\.{2,}/g, '.')
        .replace(/\s{2,}/g, ' ')
        // Trim whitespace and dots from edges
        .trim()
        .replace(/^\.+|\.+$/g, '');

    // Limit length
    if (sanitized.length > maxLength) {
        const ext = sanitized.split('.').pop();
        const nameLength = maxLength - (ext ? ext.length + 1 : 0);
        const name = sanitized.substring(0, nameLength);
        sanitized = ext ? `${name}.${ext}` : name;
    }

    // If after sanitization the filename is empty or only contains dots/spaces
    if (!sanitized || /^[\s.]+$/.test(sanitized)) {
        return 'unnamed';
    }

    return sanitized;
}

/**
 * Sanitize folder names while keeping friendly labels
 */
export function sanitizeFolderName(name: string, maxLength: number = 120): string {
    return sanitizeFilename(name, maxLength);
}

/**
 * Sanitize user identifier (email, username, etc.)
 * - Removes null bytes
 * - Removes control characters
 * - Trims whitespace
 * - Limits length
 * - Validates email format if it looks like an email
 */
export function sanitizeUserIdentifier(identifier: string, maxLength: number = 254): string {
    if (!identifier || typeof identifier !== 'string') {
        return '';
    }

    let sanitized = identifier
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove control characters
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
        // Trim whitespace
        .trim()
        // Collapse multiple spaces
        .replace(/\s{2,}/g, ' ')
        // Recipients are case-insensitive: "Maya@Acme.co" and "maya@acme.co" are the same person
        .toLowerCase();

    // Limit length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    // If it looks like an email, validate basic structure
    if (sanitized.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitized)) {
            return '';
        }
    }

    return sanitized;
}

/**
 * Escape HTML to prevent XSS when rendering user content
 */
export function escapeHtml(unsafe: string): string {
    if (!unsafe || typeof unsafe !== 'string') {
        return '';
    }

    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitize short code to ensure it only contains expected characters
 */
export function sanitizeShortCode(code: string): string {
    if (!code || typeof code !== 'string') {
        return '';
    }

    // New codes are base62; older ones came from nanoid's URL-safe alphabet and may contain - or _
    return code.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 10);
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(value: unknown, min?: number, max?: number): number | null {
    const num = Number(value);
    
    if (isNaN(num) || !isFinite(num)) {
        return null;
    }

    if (min !== undefined && num < min) {
        return min;
    }

    if (max !== undefined && num > max) {
        return max;
    }

    return num;
}

/**
 * Sanitize boolean input
 */
export function sanitizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    
    return Boolean(value);
}
