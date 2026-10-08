import type { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAccessToken, hashToken } from '@/lib/utils/tokens';
import type { Tables } from '@/lib/types';

/** How long a recipient stays signed in to one delivery. */
export const SESSION_HOURS = 24;

export function sessionCookieName(shortCode: string): string {
    return `gk_${shortCode}`;
}

export function readSessionToken(request: NextRequest, shortCode: string): string | null {
    return request.cookies.get(sessionCookieName(shortCode))?.value || null;
}

/** Start a new session for a recipient. Only one session per recipient: a new one replaces the old. */
export async function startSession(recipientId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = generateAccessToken();
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
    const { error } = await createAdminClient()
        .from('delivery_recipients')
        .update({ session_token_hash: await hashToken(token), session_expires_at: expiresAt.toISOString() })
        .eq('id', recipientId);
    if (error) throw error;
    return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, shortCode: string, token: string, expiresAt: Date): void {
    response.cookies.set({
        name: sessionCookieName(shortCode),
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: expiresAt,
        path: '/',
    });
}

export function clearSessionCookie(response: NextResponse, shortCode: string): void {
    response.cookies.set({ name: sessionCookieName(shortCode), value: '', maxAge: 0, path: '/' });
}

export type SessionResult =
    | { status: 'ok'; recipient: Tables<'delivery_recipients'> }
    | { status: 'none' | 'expired' | 'removed' | 'ended' };

/** Pure decision for a recipient found by session token. Exported for tests. */
export function evaluateSession(
    recipient: Pick<Tables<'delivery_recipients'>, 'removed_at' | 'ends_at' | 'session_expires_at'>,
    now = Date.now(),
): 'ok' | 'expired' | 'removed' | 'ended' {
    if (recipient.removed_at) return 'removed';
    if (recipient.ends_at && new Date(recipient.ends_at).getTime() <= now) return 'ended';
    if (!recipient.session_expires_at || new Date(recipient.session_expires_at).getTime() <= now) return 'expired';
    return 'ok';
}

/** The recipient a session cookie belongs to, if it's still valid for this delivery. */
export async function recipientFromSession(deliveryId: string, token: string | null): Promise<SessionResult> {
    if (!token) return { status: 'none' };
    const { data: recipient } = await createAdminClient()
        .from('delivery_recipients')
        .select('*')
        .eq('delivery_id', deliveryId)
        .eq('session_token_hash', await hashToken(token))
        .maybeSingle();
    if (!recipient) return { status: 'none' };
    const status = evaluateSession(recipient);
    return status === 'ok' ? { status, recipient } : { status };
}

/** End a recipient's session but keep the token hash, so the page can say why it ended. */
export async function endSession(recipientId: string): Promise<void> {
    await createAdminClient()
        .from('delivery_recipients')
        .update({ session_expires_at: new Date().toISOString() })
        .eq('id', recipientId);
}
