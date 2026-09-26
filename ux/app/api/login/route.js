import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  authenticate,
  createToken,
} from '@/lib/auth';

// Node rather than Edge: lib/auth.js reads the account list at module scope from
// process.env, and the proxy that guards every other route runs on Node too. One
// runtime for the gate means one set of semantics for it.
export const runtime = 'nodejs';

// ── What a repeated wrong password costs ────────────────────────────────────
//
// It costs time, and it never costs entry.
//
// A lockout is the usual answer and it is the wrong one here. The thing behind
// this gate is her safety plan — the file she wrote on a better day, naming her
// warning signs and who to call. An account lock is a design that decides, on
// the night she most needs it, that fifteen minutes of nothing is an acceptable
// price for a security property. It is not. So there is no lock, no captcha and
// no second factor: every attempt is answered, and the only thing that grows is
// how long the answer takes.
//
// A delay is enough for what is actually being defended against. The password is
// a generated secret, not a chosen one, and the attack that matters is volume —
// thousands of guesses a second against a port. Four seconds an attempt is
// fifteen a minute, which takes an online guess from feasible to pointless. A
// person who has mistyped three times waits four seconds once.
//
// ── One counter, not one per address ────────────────────────────────────────
//
// The server listens on 127.0.0.1 and is hosted nowhere else, so every caller is
// on her machine and there is no address worth telling apart. The obvious
// substitute, `x-forwarded-for`, is a header any client writes for itself, and
// keying on it would let a guesser reset the count by changing one string.
//
// The cost of a single counter is that someone else's run of guesses slows her
// sign-in too. That only happens while something on her own machine is
// guessing her password, and a four-second wait is the least of that problem.
//
// ── What this does NOT do ───────────────────────────────────────────────────
//
// The count lives in this process's memory, so restarting the server clears it.
// That is not worth a datastore. The gate's strength is the entropy of the
// secret and the constant-time compare in lib/auth.js; this is a speed bump in
// front of that, and calling it anything more would be the mistake.
const failures = { count: 0, last: 0 };

// Ten minutes. Long enough to span a run of guesses, short enough that a bad
// evening's typing is not still being charged for the next morning.
const WINDOW_MS = 10 * 60 * 1000;

// 0ms, then 250, 500, 1000, 2000, and 4000 from the fifth failure on. The first
// wrong password costs nothing at all, because the overwhelming majority of them
// are hers and a gate that punishes a typo is a gate that reads as broken.
const DELAYS_MS = [0, 250, 500, 1000, 2000, 4000];

function failureCount() {
  if (Date.now() - failures.last > WINDOW_MS) failures.count = 0;
  return failures.count;
}

function recordFailure() {
  failures.count = failureCount() + 1;
  failures.last = Date.now();
}

function wait(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export async function POST(request) {
  // 503 rather than 401 when the server has no credentials to check against.
  // Both refuse entry; only this one says the .env at the repository root was
  // never read, which is otherwise indistinguishable from a wrong password and
  // has cost people whole evenings.
  //
  // No delay on this branch: it is not an answer about a credential, so charging
  // for it would only slow down the person trying to fix the setup.
  if (!authConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const username = await authenticate(body?.username, body?.password);

  if (!username) {
    // The delay is charged to the failure that has just happened, so the first
    // guess of a run is answered at once and the tenth is not. It is derived from
    // the count alone and never from which half of the credential was wrong —
    // PRV-004 says a failure reveals nothing, and a timing channel is one of the
    // things it can reveal it through.
    const delay = DELAYS_MS[Math.min(failureCount(), DELAYS_MS.length - 1)];
    recordFailure();
    await wait(delay);
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }

  // Right password, clean slate. Whatever went before was her typing.
  failures.count = 0;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createToken(username), {
    httpOnly: true,
    sameSite: 'lax',
    // Secure in production only: locally the dev server speaks plain HTTP and a
    // Secure cookie would simply never be stored, so the gate would refuse every
    // request after a successful sign-in.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
