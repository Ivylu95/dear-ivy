import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cookies } from 'next/headers';

// WHICH record is being read, resolved per request.
//
// There are two of them, and they are not the same kind of thing:
//
//   data/     hers. The real one. Written by the agent she talks to.
//   samples/  invented. Nobody's. It exists so this app can be looked at with a
//             record in it — a timeline with years, people with files, a journal
//             that scrolls — without opening hers.
//
// Both are read by the same resolver, the same parsers and the same views, with
// no branch anywhere for "sample mode". A preview down its own code path would
// prove the preview works, not the design.
//
// ── Why this is per request and not per process ─────────────────────────────
//
// It used to be a module constant, fixed by DEAR_DATA at import. That made the
// sample a thing you restarted the server to see, which meant nobody saw it. The
// choice now lives in a cookie, so the switch is a control in the app.
//
// A cookie rather than a file on disk, for two reasons. The hosted deployment
// has a read-only filesystem, so a written flag would work at home and silently
// fail where it is actually wanted. And the question is really "what is THIS
// browser looking at" — leaving one tab in the sample while another shows the
// real record is a feature, not a race.

// Where each record lives. Resolved once at module load, because the ANSWER to
// "where is data/" never changes during a process — only which of the two is
// being read does.
//
// Three candidates each, covering the three places the process can be rooted:
//
//   ../  `npm run dev` and `next start` from ux/, which is normal.
//   ./   the process started at the repository root instead — a root-level
//        script, or a host that sets the root directory to the repo and the
//        build command to ux/.
//   env  DEAR_DATA / DEAR_SAMPLE, for anything neither of those describes.
//
// Each is identified by a marker file inside it rather than by its name, so a
// folder that is not a record is never mistaken for one. If nothing matches, the
// path still points at the most likely candidate: every read then returns null
// and every view renders its empty state, which is wrong but safe — the
// alternative, throwing at import time, takes the crisis numbers down with it.
function resolve(candidates, marker) {
  const paths = candidates.filter(Boolean);
  return paths.find((path) => existsSync(join(path, marker))) ?? paths[1];
}

const REAL = resolve(
  [process.env.DEAR_DATA, join(process.cwd(), '..', 'data'), join(process.cwd(), 'data')],
  'timeline.md',
);

const SAMPLE = resolve(
  [process.env.DEAR_SAMPLE, join(process.cwd(), '..', 'samples'), join(process.cwd(), 'samples')],
  'IS_SAMPLE',
);

export const RECORDS = {
  real: { key: 'real', dir: REAL, isSample: false, label: 'The record' },
  sample: { key: 'sample', dir: SAMPLE, isSample: true, label: 'Sample' },
};

// Whether there is a sample to switch TO. A clone without samples/ should not be
// shown a control that does nothing.
export const SAMPLE_EXISTS = existsSync(join(SAMPLE, 'IS_SAMPLE'));

export const RECORD_COOKIE = 'dear-record';

// What a browser with no cookie sees. `npm run dev:sample` sets DEAR_RECORD so
// the sample is what opens, and the switch still works from there.
const DEFAULT_KEY = process.env.DEAR_RECORD === 'sample' && SAMPLE_EXISTS ? 'sample' : 'real';

export function recordFor(key) {
  if (key === 'sample' && SAMPLE_EXISTS) return RECORDS.sample;
  return RECORDS.real;
}

// The record this request is reading. Every caller goes through here; nothing
// guesses from a path or an environment variable downstream.
export async function currentRecord() {
  let key = DEFAULT_KEY;
  try {
    key = (await cookies()).get(RECORD_COOKIE)?.value ?? DEFAULT_KEY;
  } catch {
    // Outside a request — a script importing the read layer. Falls back to the
    // default rather than throwing.
  }
  return recordFor(key);
}

// ── Carrying the answer down ────────────────────────────────────────────────
//
// The read layer in lib/content-read.js is ~700 lines of synchronous parsing
// that calls itself freely — getHome() calls getNow(), getNavCounts() calls four
// others. Threading a directory argument through all of it, or making every one
// of them async, would put the plumbing in every function in the file and leave
// one missed argument as the bug where a page reads the wrong record.
//
// So the directory is held in request-scoped storage instead. lib/content.js
// enters it once, at the boundary, and everything underneath asks for it.
const store = new AsyncLocalStorage();

// Run a synchronous read with `record` as the active one.
export function inRecord(record, fn) {
  return store.run(record, fn);
}

// The active record's folder. REAL when nothing entered a scope, which is the
// safe direction: a script that reads the record without a request reads hers,
// not a fiction.
export function activeDir() {
  return store.getStore()?.dir ?? REAL;
}
