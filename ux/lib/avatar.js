import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RECORDS } from '@/lib/data-dir';

// Her picture: the one file in the record this surface may write.
//
// ── Why this exists at all ──────────────────────────────────────────────────
//
// DSH-001, "Any viewing surface is read-only." — no mutation path, no write
// route, the absence being the design. It also predicts exactly this request:
// "just let me edit that one thing here."
//
// This file is the one exception, and it is not one the agent granted itself:
// it was raised in REVIEW.md and admitted by a person as DSH-002, "The
// single exception to DSH-001 is a thing she made rather than said: it is never
// read back to her as her own account of anything." That row is the whole of the
// permission, and it is drawn as narrowly as it can be drawn:
//
//   · One file, at one known path — data/assets/avatar.<ext>. The folder is not
//     an open drawer: this module names the one file in it that this app writes,
//     and a second kind of asset would need a second reason.
//   · Never a .md file. Nothing this route can reach is ever read back to her
//     as something she said. The record's one author is untouched.
//   · Append-only like everything else. A replaced picture moves to
//     data/archive/ with the date it was replaced (ARD-007, ARD-008).
//     Nothing here deletes.
//
// It lives in data/ and not in the app's public folder because it is hers — a
// photograph of her is as personal as anything in the record, and HAR-02 puts
// everything personal in data/ and nowhere else. The cost is that it cannot be
// served as a static asset; app/api/avatar/route.js is the door.

// data/assets/ rather than data/me/: everything else in me/ is words she said or
// things she decided, read back to her in sessions, and a binary sitting among
// them is a file every future reader has to work out the status of. Assets are a
// different kind of thing — she made them, nothing quotes them — so they get a
// folder of their own.
//
// The archive is the record's existing one, flat, with the dated
// `YYYY-MM-DD_what` naming already in use there. Not a mirrored subfolder: the
// archive's promise is "if something seems to have vanished it is here", and
// that is answered by one place to look, not by a second tree to know about.
//
// Bound to HER record and never to the sample, even while the dashboard is
// switched to the sample. Two reasons, and they point the same way: the sample
// is harness — invented, committed, read-only, nothing writes there — and this
// picture is hers, not part of anyone's fiction. The switch changes what is
// READ; it must never change where the one write lands.
//
// The view's side of that is in app/(dashboard)/layout.jsx, which passes no
// stamp at all while the sample is up, so her face does not appear beside an
// invented name.
const RECORD = RECORDS.real.dir;
const DIR = join(RECORD, 'assets');
const ARCHIVE = join(RECORD, 'archive');

// What the browser will render, and nothing else.
//
// SVG is refused on purpose, and the refusal is security rather than taste: an
// SVG is a document, it can carry script, and this one would be served from the
// app's own origin to a session that is already signed in. The other four are
// inert raster formats.
export const AVATAR_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

// 5MB. Generous for a photograph, small enough that a mis-picked video file is
// refused before it is read rather than after.
export const MAX_BYTES = 5 * 1024 * 1024;

const EXTS = Object.keys(AVATAR_TYPES);

// Move whatever picture is there into the archive, under the moment it stopped
// being current — which is the question the archive gets asked.
//
// Every extension is swept, not just the one about to be written: replacing a
// .png with a .jpg would otherwise leave two files, and findAvatar would go on
// answering with the old one.
//
// A move, never a delete, and never an overwrite. Two replacements inside one
// second would land on the same name, so the second counts up instead —
// overwriting is deletion (ARD-007), including in the archive.
function archiveCurrent() {
  const when = new Date().toISOString().slice(0, 10);
  const current = EXTS.map((e) => join(DIR, `avatar.${e}`)).filter(existsSync);
  if (!current.length) return;

  mkdirSync(ARCHIVE, { recursive: true });
  for (const old of current) {
    const ext = old.slice(old.lastIndexOf('.'));
    let target = join(ARCHIVE, `${when}_avatar${ext}`);
    for (let n = 2; existsSync(target); n += 1) {
      target = join(ARCHIVE, `${when}_avatar-${n}${ext}`);
    }
    renameSync(old, target);
  }
}

// Every write here fails the same two ways, and one of them is not a bug: the
// hosted deployment has a read-only filesystem. Saying so is the difference
// between her looking for a broken file and her knowing this only works at home.
function writeFailure(error) {
  const readOnly = error?.code === 'EROFS' || error?.code === 'EACCES' || error?.code === 'EPERM';
  return { ok: false, error: readOnly ? 'read_only' : 'write_failed' };
}

// What the bytes actually are, not what the upload claimed.
//
// The declared Content-Type comes from the browser, which takes it from the file
// extension, which comes from whoever named the file. This is served back from
// her own origin, so it is sniffed instead: the extension is decided here, from
// the header the format itself carries.
function sniff(bytes) {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  const ascii = (start, text) =>
    [...text].every((char, i) => b[start + i] === char.charCodeAt(0));
  if (ascii(0, 'GIF8')) return 'gif';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'webp';
  return null;
}

// The picture on disk, or null. Only ever one — saveAvatar archives whatever it
// finds before writing — but the extension varies with the format, so the lookup
// is by candidate rather than by a fixed filename.
export function findAvatar() {
  for (const ext of EXTS) {
    const path = join(DIR, `avatar.${ext}`);
    if (!existsSync(path)) continue;
    try {
      return { path, ext, type: AVATAR_TYPES[ext], stamp: Math.round(statSync(path).mtimeMs) };
    } catch {
      return null;
    }
  }
  return null;
}

// The mtime, as a cache-buster for the <img> the rail and the page render.
//
// Without it the browser keeps showing the previous picture after an upload: the
// URL did not change, and a same-URL image is the one thing a refresh does not
// reliably re-fetch. Null when there is no picture, which is also what the UI
// uses to decide between the photograph and the initial.
export function avatarStamp() {
  return findAvatar()?.stamp ?? null;
}

export function readAvatarBytes() {
  const found = findAvatar();
  if (!found) return null;
  try {
    return { bytes: readFileSync(found.path), type: found.type, stamp: found.stamp };
  } catch {
    return null;
  }
}

// Save a new picture, archiving whatever it replaces.
//
// Returns { ok: true, stamp } or { ok: false, error }, never throws: the caller
// is a route handler and every one of these failures has a sentence she should
// see rather than a 500.
export function saveAvatar(bytes) {
  if (!bytes?.length) return { ok: false, error: 'empty' };
  if (bytes.length > MAX_BYTES) return { ok: false, error: 'too_large' };

  const ext = sniff(bytes);
  if (!ext) return { ok: false, error: 'unsupported' };

  try {
    mkdirSync(DIR, { recursive: true });
    archiveCurrent();
    const path = join(DIR, `avatar.${ext}`);
    writeFileSync(path, bytes);
    return { ok: true, ext, stamp: Math.round(statSync(path).mtimeMs) };
  } catch (error) {
    return writeFailure(error);
  }
}

// Take the picture down, without it ceasing to have existed.
//
// The same move as a replacement, minus the write: what was there goes to the
// archive under the date it stopped being current, and the chip falls back to
// her initial. There is no path in this app that unlinks the file.
export function removeAvatar() {
  if (!findAvatar()) return { ok: true, stamp: null };
  try {
    archiveCurrent();
    return { ok: true, stamp: null };
  } catch (error) {
    return writeFailure(error);
  }
}

// Every picture she has had, newest first — the "nothing is deleted" promise
// made inspectable from code rather than only by opening the folder. Kept for
// the archive view that does not exist yet.
//
// Filtered by name rather than by extension, because the archive is shared with
// the rest of the record and most of what is in there is markdown.
export function archivedAvatars() {
  if (!existsSync(ARCHIVE)) return [];
  try {
    return readdirSync(ARCHIVE)
      .filter((name) => /_avatar(-\d+)?\.[a-z]+$/.test(name))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
