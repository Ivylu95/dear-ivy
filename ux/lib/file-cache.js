import { statSync } from 'node:fs';

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
  // Not in development, where the thing that changes is usually not the file.
  //
  // The key is the source document's mtime, which is the right question in
  // production and the wrong one while the renderer is being worked on: edit
  // lib/markdown.js, reload, and the page serves HTML built by the previous
  // version of the code, because the spec it came from is untouched. Next
  // re-evaluates the module that changed and the modules importing it, so this
  // Map survives the edit that invalidated everything in it. That failure is
  // silent and it looks exactly like a change that did not work.
  //
  // Nothing is lost by skipping it here. The cost it exists to avoid is ~18ms of
  // parsing per click on the largest spec, which matters when a reader is moving
  // through the register and does not matter at all next to a dev-mode compile.
  if (process.env.NODE_ENV !== 'production') return build();

  let stamp;
  try {
    stamp = statSync(path).mtimeMs;
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
