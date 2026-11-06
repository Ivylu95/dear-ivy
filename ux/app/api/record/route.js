import { NextResponse } from 'next/server';
import { RECORD_COOKIE, SAMPLE_EXISTS } from '@/lib/data-dir';

export const runtime = 'nodejs';

// The switch between her record and the sample one.
//
// Posted to by a plain form in the settings menu, so it works with no
// JavaScript and the redirect is the browser's own — the same shape as
// /api/logout beside it.
//
// ── Why this writes a cookie and nothing else ───────────────────────────────
//
// It changes what this browser READS, and that is the whole of it. It does not
// touch either record, does not copy anything between them, and there is no
// state on the server that could leave the two out of step. Flipping it back is
// the same post with the other value.
//
// The proxy has already refused anything without a session before this handler
// is reached, and the cookie it sets is inert on its own: an unrecognised value
// resolves to her record in lib/data-dir.js rather than to an error.
export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const asked = form?.get('record');

  // Validate before setting, and fall back rather than reject. 'sample' only
  // when there IS one — a clone without samples/ that somehow posts for it gets
  // her record, not an empty shell that looks like data loss.
  const key = asked === 'sample' && SAMPLE_EXISTS ? 'sample' : 'real';

  // Home, not back where she was. A person's page, a journal date or a timeline
  // anchor may simply not exist in the other record, and landing on a 404 after
  // flipping a switch reads as the switch having broken something.
  //
  // A RELATIVE Location, resolved by the browser against the address it actually
  // used. This is the same hazard the gate in ux/proxy.js avoids by rewriting
  // instead of redirecting, and it bites harder here: `new URL('/', request.url)`
  // reports the server's own origin, which on the dev server is localhost even
  // when the visitor typed 127.0.0.1. Those are two different hosts as far as
  // cookies are concerned, so the redirect arrived without a session and the gate
  // showed the login page — flipping a switch appeared to sign her out.
  const response = new NextResponse(null, { status: 303, headers: { Location: '/' } });
  response.cookies.set(RECORD_COOKIE, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // A year. Long enough that it is not a thing that expires mid-look, short
    // enough to be an ordinary preference rather than a permanent one.
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
