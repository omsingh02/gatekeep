import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from './lib/env';
import { isOwner } from './lib/auth/owner';

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

    const { data: { user } } = await supabase.auth.getUser();

    const owner = isOwner(user);

    // Protect admin routes: signed in is not enough, it must be the owner
    if (request.nextUrl.pathname.startsWith('/admin') && !owner) {
        const redirectUrl = new URL('/login', request.url);
        if (user) redirectUrl.searchParams.set('reason', 'not-owner');
        return NextResponse.redirect(redirectUrl);
    }

    // Send the signed-in owner away from login (a non-owner stays, to switch accounts)
    if (request.nextUrl.pathname === '/login' && owner) {
        const redirectUrl = new URL('/admin', request.url);
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/login',
    ],
};
