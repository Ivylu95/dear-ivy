import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken } from '@/lib/auth';

// The gate. Next 16 renamed the middleware convention to `proxy` and runs it on
// Node rather than the Edge runtime. It runs before every matched request, and
// it is the whole of the protection standing between her record and anything
// else that can reach the port. The surface runs on her machine and nowhere else
// — there is no hosted deployment (drafted as a DPV row, specs/REVIEW.md).
//
// Every route is gated. The default is deny and the allowlist is deliberately
// tiny: the login page, the API it posts to, and logout. Nothing that reads
// anything out of data/ is exempt.
const PUBLIC = ['/login', '/api/login', '/api/logout'];

// ── Why the response headers are set HERE ───────────────────────────────────
//
// They could sit in `headers()` in next.config.mjs instead, and that is where
// most apps put them. Two reasons they are here.
//
// The Content-Security-Policy carries a per-request nonce, and a static config
// cannot mint one. The nonce is what lets the six bootstrap scripts in the root
// layout run under a policy that otherwise refuses inline script — which is the
// whole value of having a policy, because a policy carrying 'unsafe-inline'
// refuses nothing.
//
// And the gate is already the one place every request passes through. Splitting
// the perimeter's rules across two files is how one of them goes stale without
// anything saying so.

// 128 bits, Web Crypto, no dependency — the same platform API lib/auth.js signs
// sessions with, for the same reason: one form of the code wherever it runs.
function mintNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// The policy, per request.
//
// ── What each directive is actually holding ────────────────────────────────
//
// `default-src 'self'` is the one that matters. DPV-004 says the surface makes
// no request she did not make — no font from a CDN, no analytics, no error
// reporting — and until now that was a convention held by whoever was reading
// the spec. This is the same rule stated to the browser, which enforces it
// whether or not anyone read the file: a third-party script added in a hurry
// does not silently start working, it fails in the console.
//
// `script-src` takes the nonce and NOT 'unsafe-inline'. Both together is the
// classic mistake — a browser that sees a nonce ignores 'unsafe-inline'
// entirely, so writing both yields whichever the author did not intend.
//
// `style-src` takes 'unsafe-inline' and no nonce, which is the opposite trade
// and deliberate. Ten inline `style` attributes in the app set a computed width
// or font size, and a style ATTRIBUTE cannot carry a nonce — only 'unsafe-inline'
// or 'unsafe-hashes' admits one, and hashing ten values that change as the
// reader drags a seam is not a thing that can hold. What that buys an attacker
// is CSS injection, on a surface whose only writer is the agent. Script
// injection, which is the half that can read the record, stays shut.
//
// `img-src` admits `data:` for the paper grain — a turbulence filter inlined in
// theme.generated.css as a data URI, which the browser charges to img-src.
//
// `connect-src 'self'` covers the four fetch() calls and the EventSource the
// development-only file watcher opens.
//
// There is no `report-uri` and no `report-to`. A violation report is a request
// to somewhere else naming the address it happened on, which is the exact thing
// DPV-004 forbids — a policy enforcing that rule must not break it to say so.
function policy(nonce) {
  return [
    "default-src 'self'",
    // 'unsafe-eval' under `next dev` only: Fast Refresh compiles modules with
    // it, and without it the dev server serves a page that never hydrates. A
    // production build, `next start`, has no use for it and does not get it.
    `script-src 'self' 'nonce-${nonce}'${
      process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    // Where a form may post. The sign-in form and the record switch both post to
    // this origin; nothing here should ever post anywhere else.
    "form-action 'self'",
    // Nobody frames this. The record read inside someone else's page is the
    // clickjacking case, and there is no reason this surface is ever embedded.
    "frame-ancestors 'none'",
    "frame-src 'none'",
    // No <base> may move where a relative URL resolves to.
    "base-uri 'none'",
    "object-src 'none'",
    // No `upgrade-insecure-requests`. The server speaks plain HTTP on
    // 127.0.0.1, and upgrading would send every asset request to a TLS port
    // that is not listening.
  ].join('; ');
}

// Everything that is the same on every response.
//
// `X-Robots-Tag` repeats what the root layout's metadata already says, and the
// repetition is the point: metadata reaches a crawler that parsed the HTML, and
// this reaches one that only read the headers — of a JSON route, say, which has
// no <head> to put a meta tag in.
function harden(headers, csp) {
  headers.set('Content-Security-Policy', csp);
  headers.set('X-Content-Type-Options', 'nosniff');
  // Nothing about this origin travels in a Referer, to anywhere, ever. A path
  // here can name a person — /people/<firstname> — so the browser default of
  // sending the bare origin cross-site is not tight enough.
  headers.set('Referrer-Policy', 'no-referrer');
  // The modern statement of this is frame-ancestors above; this is the one older
  // browsers read. Both, because the cost is a header.
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Hardware this surface has no use for. Reading a record needs none of it, and
  // a permission never asked for is one that cannot be granted by accident.
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  // Cache-Control is deliberately NOT set here. DPV-005 already holds without it:
  // a force-dynamic page is served `private, no-cache, no-store` in production,
  // and the two route handlers state their own. Set here, it would reach only
  // those two routes and flatten both — /api/watch's `no-store` included. The
  // `no-cache, must-revalidate` a page shows under `next dev` has no `private`
  // on it, and is the dev server's own header, not the one `next start` sends.
  //
  // No Strict-Transport-Security. There is no HTTPS origin to pin — the server
  // speaks plain HTTP on 127.0.0.1 — and a browser ignores HSTS over HTTP anyway.
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const nonce = mintNonce();
  const csp = policy(nonce);

  // Two headers forward, for two different readers.
  //
  // `x-nonce` is read by app/layout.jsx, which puts it on each of the six
  // bootstrap scripts it writes inline.
  //
  // `Content-Security-Policy` on the REQUEST is how Next itself learns the
  // nonce: it parses this header and stamps the same value onto the script tags
  // it injects — the bootstrap, and the flight data streamed after it. Without
  // it those are inline scripts with no nonce under a policy that refuses inline
  // script, and the page arrives as static HTML that never hydrates.
  const forwarded = new Headers(request.headers);
  forwarded.set('x-nonce', nonce);
  forwarded.set('Content-Security-Policy', csp);

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const open = NextResponse.next({ request: { headers: forwarded } });
    harden(open.headers, csp);
    return open;
  }

  // The cookie names the account it was issued to, and that name is checked
  // against the account list, so removing someone from config/accounts.mjs ends
  // their session on the next request rather than whenever their cookie expires.
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifyToken(token)) {
    const allowed = NextResponse.next({ request: { headers: forwarded } });
    harden(allowed.headers, csp);
    return allowed;
  }

  // Serve the login page in place rather than redirecting to it. A rewrite is
  // server-internal: no Location is emitted, the browser keeps the URL it asked
  // for, and the page renders at whatever address the visitor actually used.
  // Correct on localhost and behind a tunnel, where a redirect's Location would
  // resolve to the visitor's OWN localhost and refuse the connection.
  //
  // The protocol is forced to http because that is what the server speaks. A
  // request that arrived claiming https — through a tunnel, say — would
  // otherwise rewrite to an https origin, which Next treats as external and
  // attempts TLS against.
  const target = request.nextUrl.clone();
  target.protocol = 'http:';
  target.pathname = '/login';
  target.search = '';
  const refused = NextResponse.rewrite(target, { request: { headers: forwarded } });
  harden(refused.headers, csp);
  return refused;
}

export const config = {
  // Static assets are excluded so the login page can style itself before a
  // session exists. None of them carries anything out of data/.
  //
  // Every dot is escaped and every name terminated. Unescaped, the dot in
  // favicon.ico matches any character, so /faviconXico would also bypass the
  // gate; unterminated, a name is a prefix and /icon-anything would too.
  //
  // These get no security headers either, and that is correct rather than an
  // oversight: a stylesheet has no document to protect, and every NAVIGATION —
  // which is the thing a policy governs — passes through the gate above.
  matcher: ['/((?!_next/static/|_next/image/|favicon\\.ico$|icon\\.svg$|apple-icon$).*)'],
};
