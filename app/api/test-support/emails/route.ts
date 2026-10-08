import { NextRequest, NextResponse } from 'next/server';
import { capturedEmails } from '@/lib/email/transport';

export const dynamic = 'force-dynamic';

/**
 * Test-only: emails captured by EMAIL_TRANSPORT=memory, so end-to-end tests can read codes and
 * invites. Exists only when both EMAIL_TRANSPORT=memory and E2E_TEST_SUPPORT=1 are set (the
 * Playwright web server sets them); otherwise it's a 404 like any unknown route.
 */
export async function GET(request: NextRequest) {
    if (process.env.EMAIL_TRANSPORT !== 'memory' || process.env.E2E_TEST_SUPPORT !== '1') {
        return new NextResponse(null, { status: 404 });
    }
    const to = request.nextUrl.searchParams.get('to')?.toLowerCase();
    const emails = capturedEmails()
        .filter((email) => !to || email.to.toLowerCase() === to)
        .map(({ to: recipient, from, subject, text, sentAt }) => ({ to: recipient, from, subject, text, sentAt }));
    return NextResponse.json({ emails });
}
