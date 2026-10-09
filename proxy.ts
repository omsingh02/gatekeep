import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from './lib/env';
import { isOwner } from './lib/auth/owner';
import { getSignedIn, needsTwoFactorCode } from './lib/auth/twoFactor';

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        env.supabase.url,
        env.supabase.anonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user, aal } } = await getSignedIn(supabase);

    const owner = isOwner(user);
    // With two-factor sign-in on, the password alone isn't enough: the code step comes first
    const codeNeeded = owner && needsTwoFactorCode(user, aal);
    const { pathname, searchParams } = request.nextUrl;

    // Protect admin routes: signed in is not enough, it must be the owner
    if (pathname.startsWith('/admin') && !owner) {
        const redirectUrl = new URL('/login', request.url);
        if (user) redirectUrl.searchParams.set('reason', 'not-owner');
        return redirectWithCookies(redirectUrl, response);
    }

    if (codeNeeded && (pathname.startsWith('/admin') || (pathname === '/login' && searchParams.get('step') !== 'code'))) {
        return redirectWithCookies(new URL('/login?step=code', request.url), response);
    }

    // Send the fully signed-in owner away from login (a non-owner stays, to switch accounts)
    if (pathname === '/login' && owner && !codeNeeded) {
        const redirectUrl = new URL('/admin', request.url);
        return redirectWithCookies(redirectUrl, response);
    }

    return response;
}

/** A redirect that keeps any session cookies Supabase refreshed while checking the request. */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
    const redirect = NextResponse.redirect(url);
    from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
}

// /forgot-password and /reset-password are deliberately not matched: they must work signed out,
// and a reset link signs the owner in on /reset-password, which must not bounce them elsewhere.
export const config = {
    matcher: [
        '/admin/:path*',
        '/login',
    ],
};
