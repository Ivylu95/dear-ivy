import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Work done once per version of a file, rather than once per request.
//
// Every route in this app is `force-dynamic` — it must show what is on disk
// right now, not what was on disk when the build ran — so the alternative to
// this is re-reading and re-parsing the same unchanged document on every click.
// Reading it is cheap; parsing a 22kb spec into HTML is not, and it is the same
// HTML each time.
//
// ── Why mtime and not a timer ───────────────────────────────────────────────
//
// A time-based cache has to choose between stale and useless: long enough to
// help and it serves a file the agent edited a moment ago, short enough to be
// safe and it expires before the next click. The modification time makes the
// question exact — the answer is reused while, and only while, the file it came
// from has not changed.
//
// lib/content-read.js carried its own version of this for the record since the
// first views were written, twice over — once for markdown and once for the YAML
// settings, both keyed on the path alone and sharing one Map, so a path read
// both ways would have had one answer for the other. This is that idea extracted
// once, and `key` is the part that fixes it: the reader says what it is building,
// so two derived values from one file cannot collide.
//
// What did NOT move here is the second cache in that file, over rendered HTML.
// It compares the identity of the object readFile already returned rather than
// stat()ing again, which is cheaper than this and correct only there.
//
// ── Why the key also carries the code that built the value ─────────────────
//
// The file's mtime answers "has the input changed". It cannot answer "has the
// function that turned the input into this value changed", and under `next dev`
// that is the question that matters: edit lib/markdown.js, reload, and a key
// built from the spec's mtime alone serves HTML made by the previous version of
// the renderer, because the spec is untouched. Next re-evaluates the module that
// changed and the modules importing it, not this one, so the Map below survives
// the very edit that invalidated everything in it. The failure is silent and
// looks exactly like a change that did not work.
//
// Until 2026-10-07 the answer to that was to switch this off outside production.
// It was the safe answer and an expensive one: an audit that day (DES-008) found
// every dev request re-reading and re-parsing every record file it touched, and
// content-read.js's identity-keyed caches over rendered HTML and derived values
// never hitting at all, because a fresh parse is a fresh object every time. The
// developer's copy runs `next dev` all day, so dev is where the cost was paid.
//
// So the code goes into the key instead. CODE below is every module whose
// output is cached through here — the readers that call fromFile and the
// renderers their builds run — and their mtimes, joined, are a version stamp for
// the code. Edit any of them and every entry misses once and is rebuilt by the
// new code. It is resolved from this file's own location, not process.cwd(),
// because the dashboard runs from ux/ and the admin app from dev/ui/ and both
// import this one file. A module added to a cached build has to be added to
// CODE; one left out is the old silent staleness, for edits to that module only.
const CODE = [
  'markdown.js',
  'views.js',
  'content-read.js',
  '../../.claude/hooks/lib/profile-schema.mjs',
  // What the harness reader parses spec rows and skips folders with.
  '../../.claude/hooks/lib/spec-rows.mjs',
  'walk-skip.mjs',
  // The admin app's readers (dev/ui/lib/harness.js), absent in a copy without
  // dev/ — a missing file is a stable part of the stamp, not an error.
  '../../dev/ui/lib/harness.js',
  '../../dev/ui/lib/harness-code.js',
  '../../dev/ui/lib/code-highlight.js',
];

let codeDir = null;
try {
  codeDir = dirname(fileURLToPath(import.meta.url));
} catch {
  // No usable location for this module: the stamp cannot be taken, and the
  // cache stays off in development, as it was before 2026-10-07.
}

// Seven stats measured at 0.23ms on this machine (2026-10-07; nine now), and a page
// runs fromFile a few dozen times, so the stamp is taken at most once per
// STAMP_TTL rather than on every call. That cannot serve a stale value: an entry
// keyed on the old stamp is never returned once the stamp has moved.
const STAMP_TTL = 250;

// A code file changed less than this long ago is still settling, and nothing is
// cached while one is. The stamp moves when the file is saved; the server only
// runs the new code once Next has recompiled it, and a request in between would
// cache the OLD code's output under the NEW stamp, where nothing would ever
// replace it. Five seconds is longer than this app's slowest measured recompile
// (1-3s, 2026-10-07), and costs nothing but a few uncached requests after an
// edit.
const SETTLE_MS = 5000;

let code = { at: 0, stamp: null, newest: 0 };

function codeStamp() {
  const now = Date.now();
  if (now - code.at < STAMP_TTL) return code;
  let newest = 0;
  const stamp = CODE.map((file) => {
    try {
      // Ignored by the bundler's file tracing: this runs only under `next dev`,
      // and a stat of a path built at runtime otherwise makes a production
      // build trace the whole repository into its output.
      const { mtimeMs } = statSync(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ codeDir, file));
      newest = Math.max(newest, mtimeMs);
      return mtimeMs;
    } catch {
      return -1;
    }
  }).join(',');
  code = { at: now, stamp, newest };
  return code;
}

const entries = new Map();

/**
 * Run `build` for `path`, and return the same result until the file changes.
 *
 * A file that cannot be stat'ed — deleted between the caller's check and this
 * one — drops through to `build`, which is where the error belongs: this is a
 * cache, and inventing an answer for a missing file is not its business.
 *
 * @param {string} path  Absolute path to the file the work depends on.
 * @param {string} key   What is being built from it, so one file can hold more
 *                       than one derived value — its text and its rendered HTML.
 * @param {() => T} build
 * @returns {T}
 * @template T
 */
export function fromFile(path, key, build) {
  // In production the code cannot change under a running server, so the file's
  // mtime is the whole question. In development the code is part of it too: see
  // "Why the key also carries the code" above. No stamp, or code still settling
  // from an edit, and this is a plain build, as development always was before.
  let version = '';
  if (process.env.NODE_ENV !== 'production') {
    if (!codeDir) return build();
    const current = codeStamp();
    if (Date.now() - current.newest < SETTLE_MS) return build();
    version = current.stamp;
  }

  let stamp;
  try {
    stamp = `${statSync(path).mtimeMs}|${version}`;
  } catch {
    return build();
  }

  const id = `${key}:${path}`;
  const hit = entries.get(id);
  if (hit && hit.stamp === stamp) return hit.value;

  const value = build();
  entries.set(id, { stamp, value });
  return value;
}
