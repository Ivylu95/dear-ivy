import { readdirSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';
import { HARNESS, SPECS } from '@/lib/harness-dir';
import { currentRecord } from '@/lib/data-dir';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tells an open tab that a file on disk changed, so it can re-read it.
//
// ── Why this has to exist at all ────────────────────────────────────────────
//
// Every route in this app is force-dynamic and the mtime cache in
// lib/file-cache.js switches itself off outside production, so the server never
// serves a stale file — it re-reads from disk on every request. What is missing
// is the request. Fast Refresh is driven by the bundler's watcher over the
// MODULE GRAPH, and none of the markdown this app renders is in it: it is read
// at request time from ../data and ../.claude, both outside ux/ entirely. The
// bundler does not know those files exist, so saving one produces no event, no
// re-render, and a page that keeps showing what it already rendered until
// somebody presses F5.
//
// That is fine for her — deployed, she opens the page and it is current. It is
// not fine while the agent is writing the record in one window and the dashboard
// is open in another, which is most of how this app gets built.
//
// ── Development only, in two places ─────────────────────────────────────────
//
// The layout does not render the client half in production, and this handler
// refuses there as well. Two gates rather than one because they fail
// differently: the first keeps the connection from ever being opened, the second
// means it does not matter if something opens it anyway.
//
// It sits behind the gate like everything else — it is not on PUBLIC in
// ux/proxy.js, so it adds no opening to the perimeter and nothing to count in
// scripts/check-perimeter.mjs.

// ── Telling a save apart from the sync noise around it ─────────────────────
//
// This repository lives inside a OneDrive folder, and OneDrive reacts to a write
// by touching files near it. That is not a guess: watching the two roots through
// one save of one spec produced four events — the real change, the same file
// twice more, and REVIEW.md, which nothing had edited. A wider trace caught
// a burst of eleven untouched files 641ms after a write, and more from the
// record root two seconds after that. One save, four refreshes.
//
// The debounce cannot help with this. It collapses events that arrive TOGETHER,
// and the echoes arrive hundreds of milliseconds to seconds apart — deliberately
// outside any window short enough to keep a refresh feeling immediate.
//
// What separates them is that the echo does not change the file. Same mtime,
// same size, so a stat answers the question exactly: has this file actually
// moved since the last time an event named it? The measured 4 events became 1.
//
// The path is used here and goes no further. It is never put in the stream — see
// the tick below for why that matters more than it looks like it does.
const marks = new Map();

function reallyChanged(root, file) {
  // An event with no filename carries nothing to check. Assume it was real: a
  // spurious refresh is a cost, a missed one is the bug this file exists to fix.
  if (!file) return true;

  const path = join(root, String(file));
  let mark;
  try {
    const stat = statSync(path);
    mark = `${stat.mtimeMs}:${stat.size}`;
  } catch {
    // Deleted, or renamed away. That is a real change.
    mark = 'gone';
  }

  const before = marks.get(path);
  marks.set(path, mark);
  return before !== mark;
}

// Every file under a root, stamped, so the FIRST event about a file can be
// judged like any other. Without it each file gets one free spurious refresh —
// which sounds negligible until the first save of a session, when OneDrive
// touches a dozen files it has never been asked about and every one of them is
// new. A few hundred stats, once, when the first tab connects.
function prime(root) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      prime(path);
      continue;
    }
    try {
      const stat = statSync(path);
      marks.set(path, `${stat.mtimeMs}:${stat.size}`);
    } catch {
      // Vanished mid-walk. It will be judged new if it ever comes back.
    }
  }
}

// ── One watcher per folder, not one per tab ────────────────────────────────
//
// Watching is per FOLDER; being told about it is per connection. Those were the
// same thing in the first version of this file, which meant two tabs open on the
// dashboard put two recursive watches on the record and two on the harness, each
// pair reporting the same events — and a dev session leaves tabs open.
//
// So the watch is held here, at module scope, and connections subscribe to it.
// The last one to leave closes it, which keeps the property that matters: a dev
// server with no dashboard open is watching nothing.
//
// Keyed by folder rather than by connection because the two roots are not the
// same for every tab — one showing the sample and one showing the real record
// share the harness watch and hold different record watches.
const rooms = new Map();

function subscribe(root, listener) {
  let room = rooms.get(root);

  if (!room) {
    room = { watcher: null, listeners: new Set() };
    try {
      // Recursive works on Windows and macOS natively, and on Linux from Node
      // 20.13. A platform where it does not is not a broken app: this throws,
      // the catch returns a no-op, and the tab behaves as it did before any of
      // this existed — current on refresh.
      prime(root);
      room.watcher = watch(root, { recursive: true }, (event, file) => {
        if (!reallyChanged(root, file)) return;
        for (const fn of room.listeners) fn();
      });
      // fs.watch emits errors rather than throwing them once it is running — a
      // folder renamed underneath it, a handle exhausted. An unhandled one takes
      // the dev server down, which is far worse than losing the auto-refresh.
      room.watcher.on('error', () => {});
    } catch {
      return () => {};
    }
    rooms.set(root, room);
  }

  room.listeners.add(listener);

  return () => {
    room.listeners.delete(listener);
    if (room.listeners.size > 0) return;
    room.watcher.close();
    rooms.delete(root);
  };
}

// How long the filesystem has to be quiet before a change is announced.
//
// Both halves of this matter. An agent writing a session's worth of record
// touches six or eight files in a couple of seconds, and each one arrives as
// several events — editors and git write through a temporary file and rename it,
// so one save is a create, a change and a rename. Announcing each would re-run
// the whole server tree that many times, and that tree shells out to git in
// lib/git.js. Waiting for the writing to STOP collapses all of it into one
// refresh, and has the second benefit of not rendering a file mid-write.
const QUIET_MS = 250;

// The heartbeat, and it does more work than it looks like it does.
//
// The obvious job is keep-alive: a connection idling behind something with its
// own timeout is kept rather than dropped and reopened, and a reconnect is not
// free here because it tears down the watchers and builds new ones.
//
// The job that actually matters was found by instrumenting close() and watching
// the log while connections were dropped the way a closed tab drops one.
// `request.signal` is the documented way to hear about that and it is NOT
// prompt — the aborts arrived between 6 and 30 seconds late, and the 30s ones
// were this interval firing rather than the signal. A write to a socket nobody
// is reading is what makes the disconnect observable: the enqueue throws, send()
// calls close(), and the watchers go.
//
// So this is the backstop that bounds how long a closed tab's recursive watcher
// can outlive it, and the interval IS that bound. Removing it, or making it much
// longer, leaks a watcher per tab until the dev server restarts.
const BEAT_MS = 30_000;

export async function GET(request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });

  // The record this BROWSER is looking at, not a fixed folder — the sample and
  // the real record are chosen per browser by cookie, and a tab showing one
  // should not be refreshed by a write to the other. The harness is the same
  // folder either way.
  const record = await currentRecord();
  const roots = [...new Set([record.dir, HARNESS, SPECS])];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let unsubscribes = [];
      let quiet = null;
      let beat = null;
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(quiet);
        clearInterval(beat);
        // Without this, every HMR reload of this module would leave this
        // connection's share of the watches held for the life of the dev server.
        for (const off of unsubscribes) off();
        unsubscribes = [];
        try {
          controller.close();
        } catch {
          // Already closed by the runtime. Nothing to do and nothing wrong.
        }
      };

      const send = (text) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          close();
        }
      };

      // A bare tick, carrying NO path — and that is a privacy decision, not a
      // minimalism one. The obvious payload is the file that changed, and the
      // files that change most here are data/people/<firstname>.md. A first name
      // is the most personal thing in the whole record and it is not supposed to
      // exist outside data/ in any form. scripts/check-privacy.mjs greps harness
      // FILES for names and would never see this, because a stream is not a file
      // it can read. So the rule is kept here by construction instead: the client
      // is told that something changed, and re-reads everything it is showing.
      const changed = () => {
        clearTimeout(quiet);
        quiet = setTimeout(() => send('data: tick\n\n'), QUIET_MS);
      };

      unsubscribes = roots.map((root) => subscribe(root, changed));

      beat = setInterval(() => send(': beat\n\n'), BEAT_MS);

      request.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  });
}
