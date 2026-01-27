/**
 * Structured logging for API routes and utilities.
 * Minimal logger that adds context without external dependencies.
 * 
 * Usage:
 *   const reqId = generateRequestId();
 *   logInfo('/api/verify', 'access-attempt', { requestId: reqId, shortCode: 'abc123' });
 *   logError('/api/presign', userId, 'generate-upload-url', error, { requestId: reqId });
 * 
 * Logs to console in JSON format for easy parsing in production logs.
 * These are SERVER-SIDE ONLY logs - never visible to end users.
 * Never logs sensitive data (passwords, tokens, full email addresses).
 */

interface LogContext {
    [key: string]: string | number | boolean | undefined;
}

/**
 * Generate a short unique request ID for correlating logs
 */
export function generateRequestId(): string {
    return Math.random().toString(36).substring(2, 10);
}

function redactSensitive(context: LogContext): LogContext {
    return Object.entries(context).reduce((acc, [key, val]) => {
        if (key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('secret')) {
            acc[key] = '[REDACTED]';
        } else {
            acc[key] = val;
        }
        return acc;
    }, {} as LogContext);
}

export function logInfo(
    route: string,
    action: string,
    context?: LogContext
): void {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        route,
        action,
        ...(context && redactSensitive(context)),
    };

    console.log(JSON.stringify(logEntry));
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
        ...(context && redactSensitive(context)),
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
        ...(context && redactSensitive(context)),
    };

    console.warn(JSON.stringify(logEntry));
}
