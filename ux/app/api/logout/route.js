import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

// Posted to by a plain form in the rail, so signing out works with no JavaScript
// and the redirect is the browser's own.
//
// A RELATIVE Location, for the reason set out at length in ../record/route.js:
// `new URL(..., request.url)` reports the SERVER's origin, not the one the
// visitor used, so on the dev server it moves her from 127.0.0.1 to localhost —
// and a session cookie does not follow across those two. Here that meant signing
// back in landed her on an address she had not asked for; on the record switch
// beside it, it looked like being signed out for no reason.
export async function POST() {
  const response = new NextResponse(null, { status: 303, headers: { Location: '/login' } });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
