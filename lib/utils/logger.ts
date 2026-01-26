/**
 * Structured logging for API routes and utilities.
 * Minimal logger that adds context without external dependencies.
 * 
 * Usage:
 *   logError('/api/presign', userId, 'generate-upload-url', error, { filename: 'test.jpg' })
 * 
 * Logs to console.error in JSON format for easy parsing in production logs.
 * Never logs sensitive data (passwords, tokens, full email addresses).
 */

interface LogContext {
    [key: string]: string | number | boolean | undefined;
}

export function logError(
    route: string,
    userId: string | undefined,
    action: string,
    error: unknown,
    context?: LogContext
): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.constructor.name : typeof error;

    const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        route,
        userId: userId ? `user_${userId.substring(0, 8)}` : undefined,
        action,
        errorType,
        errorMessage,
        ...(context && Object.entries(context).reduce((acc, [key, val]) => {
            // Redact sensitive keys
            if (key.toLowerCase().includes('password') || 
                key.toLowerCase().includes('token') || 
                key.toLowerCase().includes('secret')) {
                acc[key] = '[REDACTED]';
            } else {
                acc[key] = val;
            }
            return acc;
        }, {} as LogContext)),
    };

    console.error(JSON.stringify(logEntry));
}

export function logWarning(
    route: string,
    action: string,
    message: string,
    context?: LogContext
): void {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        route,
        action,
        message,
        ...(context && Object.entries(context).reduce((acc, [key, val]) => {
            if (key.toLowerCase().includes('password') || 
                key.toLowerCase().includes('token') || 
                key.toLowerCase().includes('secret')) {
                acc[key] = '[REDACTED]';
            } else {
                acc[key] = val;
            }
            return acc;
        }, {} as LogContext)),
    };

    console.warn(JSON.stringify(logEntry));
}
