/**
 * Email notification utilities using Resend
 * 
 * Sends transactional emails for access grants.
 * Fails silently - email errors should not block access grant creation.
 */

import { Resend } from 'resend';
import { env } from './env';

// Initialize Resend client (lazy - only when needed)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
    if (!process.env.RESEND_API_KEY) {
        return null;
    }
    if (!resendClient) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
    }
    return resendClient;
}

interface AccessGrantEmailParams {
    to: string;
    fileName: string;
    shortCode: string;
    password: string;
    expiresAt?: string | null;
    maxDownloads?: number | null;
    grantedBy?: string;
}

/**
 * Send an email notification when access is granted to a file.
 * 
 * @returns true if email was sent successfully, false otherwise
 */
export async function sendAccessGrantEmail(params: AccessGrantEmailParams): Promise<boolean> {
    const resend = getResendClient();
    
    if (!resend) {
        console.warn('[Email] RESEND_API_KEY not configured, skipping email');
        return false;
    }

    // The sender must be on a domain verified in Resend
    const fromEmail = process.env.EMAIL_FROM;
    if (!fromEmail) {
        console.warn('[Email] EMAIL_FROM not configured, skipping email');
        return false;
    }

    const fileLink = `${env.app.url}/${params.shortCode}`;

    // Format expiration date if provided
    let expirationText = '';
    if (params.expiresAt) {
        const expDate = new Date(params.expiresAt);
        expirationText = expDate.toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }

    try {
        const { error } = await resend.emails.send({
            from: fromEmail,
            to: params.to,
            subject: `Access granted: ${params.fileName} — Gatekeep`,
            html: generateEmailHtml(params, fileLink, expirationText),
            text: generateEmailText(params, fileLink, expirationText),
        });

        if (error) {
            console.error('[Email] Failed to send access grant email:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[Email] Error sending access grant email:', err);
        return false;
    }
}

function generateEmailHtml(
    params: AccessGrantEmailParams,
    fileLink: string,
    expirationText: string
): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0b10; color: #e4e4e7; padding: 40px 20px; margin: 0;">
    <div style="max-width: 480px; margin: 0 auto; background-color: #12141c; border-radius: 12px; padding: 32px; border: 1px solid #262838;">
        <div style="text-align: center; margin-bottom: 24px;">
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: linear-gradient(135deg, #6366f1 0%, #22d3ee 100%); vertical-align: middle;"></span>
            <span style="font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff; vertical-align: middle; margin-left: 6px;">gatekeep</span>
        </div>
        
        <h1 style="font-size: 20px; font-weight: 600; color: #ffffff; text-align: center; margin: 0 0 8px 0;">
            You've been granted file access
        </h1>
        
        <p style="font-size: 14px; color: #9ca3af; text-align: center; margin: 0 0 24px 0;">
            Someone has shared a file with you
        </p>

        <div style="background-color: #1a1a1a; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">File</td>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 13px; text-align: right; font-weight: 500;">${escapeHtml(params.fileName)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Password</td>
                    <td style="padding: 8px 0; color: #a5b4fc; font-size: 13px; text-align: right; font-family: monospace; font-weight: 600;">${escapeHtml(params.password)}</td>
                </tr>
                ${expirationText ? `
                <tr>
                    <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Expires</td>
                    <td style="padding: 8px 0; color: #f59e0b; font-size: 13px; text-align: right;">${expirationText}</td>
                </tr>
                ` : ''}
                ${params.maxDownloads ? `
                <tr>
                    <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Download limit</td>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 13px; text-align: right;">${params.maxDownloads} downloads</td>
                </tr>
                ` : ''}
            </table>
        </div>

        <a href="${fileLink}" style="display: block; width: 100%; padding: 12px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; box-sizing: border-box;">
            Access File
        </a>

        <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 20px 0 0 0;">
            Use your email address and the password above to access the file.
        </p>
    </div>
    
    <p style="font-size: 11px; color: #4b5563; text-align: center; margin-top: 24px;">
        Sent by Gatekeep · This is an automated message. Please do not reply.
    </p>
</body>
</html>
`;
}

function generateEmailText(
    params: AccessGrantEmailParams,
    fileLink: string,
    expirationText: string
): string {
    let text = `You've been granted file access

File: ${params.fileName}
Password: ${params.password}
`;

    if (expirationText) {
        text += `Expires: ${expirationText}\n`;
    }

    if (params.maxDownloads) {
        text += `Download limit: ${params.maxDownloads} downloads\n`;
    }

    text += `
Access the file here: ${fileLink}

Use your email address and the password above to access the file.

Sent by Gatekeep. This is an automated message. Please do not reply.
`;

    return text;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
