// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): finding, reading and caching the record's files. Nothing here writes.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activeDir } from '@/lib/data-dir';
import { fromFile } from '@/lib/file-cache';
import matter from 'gray-matter';
import { dropLeadingH1, fileHasContent, renderBody, stripComments } from '@/lib/markdown';
import { CORE_DATA } from '../../../.claude/hooks/lib/modules.mjs';

// core's files, under data/core/ (ARC-006). A module's own files are read by
// their module's folder, as therapy/ is below.
export const core = (path) => `${CORE_DATA}/${path}`;

// ── Finding the record ──────────────────────────────────────────────────────
//
// One resolver, in lib/data-dir.js, shared with the one other module that
// touches the folder. Two copies of "where is the record" is the shape of bug
// where the dashboard reads one folder and writes into another.
//
// activeDir() rather than a constant, because there are two records now and the
// choice is per request. It is a call, not an argument threaded through every
// function in this file, so that nothing in here has to remember to pass it on.

// ── Cache ───────────────────────────────────────────────────────────────────
// Keyed on mtime, so a file rewritten mid-session re-parses and an untouched one
// costs a stat() rather than a read and a markdown pass. That mechanism is
// lib/file-cache.js now, shared with the harness rather than written out once
// per reader here — and its `key` is what lets one path hold both a parsed
// markdown file and a parsed YAML one without either answering for the other.
//
// A read that THROWS is deliberately not cached: fromFile stores what build
// returns, so an exception leaves the entry absent and the next request tries
// again. That is the behaviour a transient IO error wants. A parse that fails
// and returns null IS cached — see readConfig, where null is the answer rather
// than the absence of one.

export function readFile(relative) {
  const path = join(activeDir(), relative);
  try {
    return fromFile(path, 'record-md', () => parseRecordFile(path, relative));
  } catch {
    return null;
  }
}

// Everything readFile does once per version of a file. Separate so the cache
// wrapper above stays one line and this stays the part worth reading.
//
// It lets readFileSync throw rather than catching it, which is what keeps a
// failed read out of the cache.
function parseRecordFile(path, relative) {
  const raw = readFileSync(path, 'utf8');

  // gray-matter, because a file may one day carry frontmatter even though none
  // does today. A file without it returns its whole body, so this costs nothing.
  const parsed = matter(raw);
  const data = parsed.data;
  // Commented-out templates are stripped once, here at the door, so that section
  // parsing, the emptiness check and rendering all see the same file — the one
  // without the scaffolding in it.
  const content = stripComments(parsed.content);
  const value = {
    path: relative,
    raw: content,
    meta: data ?? {},
    filled: fileHasContent(content),
    // `updated` from frontmatter if present, otherwise from the "_Last updated:
    // YYYY-MM-DD_" line the templates use. Never from the filesystem mtime: a
    // clone, a checkout or a sync rewrites that, and a record that claims to have
    // changed when it did not is worse than one that says nothing.
    updated:
      data?.updated ??
      /_Last updated:\s*(\d{4}-\d{2}-\d{2})_/.exec(content)?.[1] ??
      null,
  };

  return value;
}

export function listDir(relative, { extension = '.md', skip = ['README.md'] } = {}) {
  const path = join(activeDir(), relative);
  try {
    return readdirSync(path)
      .filter((f) => f.endsWith(extension) && !skip.includes(f) && !f.startsWith('.'))
      .sort();
  } catch {
    return [];
  }
}

// A file rendered for display: its HTML, whether anything is actually in it, and
// where it came from. `titled` drops the file's own h1 when the view supplies the
// heading itself.
//
// Cached on the same mtime key as readFile, because the RAW read was never the
// expensive part — the markdown pass is. One request for the home view calls
// getPeople() three times over (the nav counts, the people strip, the blank
// check), and before this every one of those re-parsed every person's file from
// scratch. The file cache underneath made the disk read free and left the work
// that actually costs something to run three times.
const rendered = new Map();

export function render(relative, { titled = true } = {}) {
  const file = readFile(relative);
  if (!file) return null;

  // Keyed on the ABSOLUTE path, not the relative one: both records have a
  // state/now.md, and a key that only named the file would hand the sample's
  // rendering back for hers the moment the switch was flipped.
  const key = `${join(activeDir(), relative)}::${titled}`;
  const hit = rendered.get(key);
  // `file` is the cached object identity from readFile, so an unchanged file
  // hands back the same reference and this comparison is the mtime check without
  // stat()ing twice.
  if (hit && hit.file === file) return hit.value;

  const html = renderBody(file.raw);
  const value = {
    ...file,
    html: titled ? dropLeadingH1(html) : html,
    // The first `# Heading`, so a view can name a file without hardcoding what it
    // is called.
    title: /^#\s+(.+?)\s*$/m.exec(file.raw)?.[1] ?? null,
  };

  rendered.set(key, { file, value });
  return value;
}

// Anything else built from one file — the timeline split into entries, a
// person's lead read for a phone number, the safety plan's sections rendered —
// cached on that same identity, for the same reason render() is. React's cache()
// in lib/content.js saves a getter the second time a request asks for it, but
// not when one getter here calls another (getMentions → getTimeline, the safety
// plan → getPeople), and not across requests: before this, every page load
// re-split and re-rendered every one of these from text that had not changed.
//
// `kind` says what is being built, so two things derived from one file cannot
// answer for each other. The value is shared between requests, which is safe for
// the reason content.js gives: no view mutates what it is handed.
const derived = new Map();

export function derive(file, kind, build) {
  const key = `${join(activeDir(), file.path)}::${kind}`;
  const hit = derived.get(key);
  if (hit && hit.file === file) return hit.value;
  const value = build(file);
  derived.set(key, { file, value });
  return value;
}
