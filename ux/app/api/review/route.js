import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionUser } from '@/lib/auth';
import { MAX_NOTE, decide } from '@/lib/review';

// Clearing one item from the review queue.
//
// The second write route in this app, and it writes to the harness rather than
// to the record — `.claude/REVIEW.md`, whose own first line says it is
// "written by the agent; cleared by a person". Until now there was no surface
// for the second half of that sentence.
//
// It takes an item id, a verdict and an optional note, and nothing else. There
// is no path parameter: lib/review.js resolves the one file it is allowed to
// touch at module load, so no request can name a different one, and the only
// text this route composes is the outcome cell. The finding itself is moved
// word for word.
//
// Node runtime: this reads and writes the filesystem, which the Edge runtime has
// no access to.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DECISIONS = new Set(['accept', 'reject', 'reopen']);

// The proxy already refuses anything without a session before this handler is
// reached. It is checked again here anyway, for the reason the avatar route
// gives: this route CHANGES something, and the cost of the gate's matcher being
// loosened one day by someone who did not know that should not be a stranger
// editing the specs ledger.
async function gate(request) {
  const account = await sessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  return account ? null : NextResponse.json({ error: 'unauthorised' }, { status: 401 });
}

export async function POST(request) {
  const denied = await gate(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const id = typeof body?.id === 'string' ? body.id : '';
  const decision = typeof body?.decision === 'string' ? body.decision : '';
  // Validated before anything is read off disk, and by shape rather than by
  // trust: an id is the truncated sha1 lib/review.js derives, so anything that
  // is not twelve hex characters cannot match an item and is refused here
  // rather than searched for.
  if (!/^[0-9a-f]{12}$/.test(id) || !DECISIONS.has(decision)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const note = typeof body?.note === 'string' ? body.note.slice(0, MAX_NOTE) : '';

  const result = decide({ id, decision, note });
  if (!result.ok) {
    // `stale` is a 409 rather than a 404 on purpose. The item is not missing —
    // the file moved under the reader, which is exactly what happens when a
    // session appends to the queue while it is open on screen. The page re-reads
    // and shows what is actually there now.
    const status =
      result.error === 'stale'
        ? 409
        : result.error === 'read_only'
          ? 503
          : result.error === 'no_file'
            ? 404
            : result.error === 'bad_decision'
              ? 400
              : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
