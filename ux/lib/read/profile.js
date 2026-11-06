// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the profile reader. Nothing here writes.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activeDir } from '@/lib/data-dir';
import { fromFile } from '@/lib/file-cache';
import { load as parseYaml } from 'js-yaml';
import { todayIn } from '@/lib/dates';
import { isLegacyProfile, parseProfile, QUESTIONS, validateRecordConfig } from '../../../.claude/hooks/lib/profile-schema.mjs';
import { pronouns } from '@/lib/pronouns';

const CONFIG_PATH = 'PROFILE.yaml';
// ── Who this is for ────────────────────────────────────────────────────────

// The name, and the only place the app gets it.
//
// It started as frontmatter on about_me.md and moved to data/PROFILE.yaml when
// there was a second reader: a file that is prose for her, carrying one line
// that is not, is a file where the machine-readable part gets edited away by
// someone tidying the prose.
//
// It lives in the record because it is hers, not the harness's: HAR-02 puts
// everything personal in data/ and nothing personal outside it, and a name
// hard-coded into a component is exactly the leak that rule exists to stop. The
// app shipped with the name written into three files.
//
// The shape is validated in one place, .claude/hooks/lib/profile-schema.mjs, so the build gate and
// this reader cannot disagree about what a valid value is.
//
// Returns null when nothing is recorded, which is the state on first contact —
// the caller decides what to say to someone who has not told us their name yet.
// It does not invent one.
// The record's one structured file, parsed and cached on mtime like the rest.
//
// Separate from readFile() rather than a flag on it: that one is built for
// markdown — frontmatter, comment stripping, section splitting, an emptiness
// heuristic — and none of it means anything here. A YAML file that went through
// it would be silently mangled by the parts that assume prose.
//
// A parse error returns null rather than throwing. check-profile.mjs --all is
// what refuses to ship a broken file; a page that has one anyway should fall
// back, not 500.
// An old flat profile, shaped like the new one so the one validator reads both:
// a plain answer counts as answered, and a marker or a blank as not.
function legacyAsSections(flat) {
  const out = { mandatory: {}, recommended: {}, optional: {} };
  for (const [q, spec] of Object.entries(QUESTIONS)) {
    const v = typeof flat[q] === 'string' ? flat[q].trim() : '';
    const answered = v && !/^(declined|asked \d|removed \d)/i.test(v);
    out[spec.section][q] = answered
      ? { value: v, status: 'answered', status_reason: '', last_updated: '2000-01-01T00:00:00Z' }
      : { value: '', status: 'not_asked', status_reason: '', last_updated: '' };
  }
  return out;
}

function readConfig() {
  const path = join(activeDir(), CONFIG_PATH);
  try {
    return readConfigAt(path);
  } catch (error) {
    // Absence is asked only once a read has failed, so the common path costs one
    // stat rather than two. No file reads as null; any other failure still throws.
    if (!existsSync(path)) return null;
    throw error;
  }
}

function readConfigAt(path) {
  // A different key on the same path from readFile's, which is the whole reason
  // fromFile takes one: a shared cache keyed on the path alone would let a
  // markdown parse answer a request for settings, or the other way round.
  return fromFile(path, 'record-yaml', () => {
    // The same strict parser the checks and hooks use, so what the page reads is
    // what they validated. A profile still in the old flat shape reads as js-yaml
    // parses it, until the next session start migrates it.
    const text = readFileSync(path, 'utf8');
    if (isLegacyProfile(text)) {
      try {
        const flat = parseYaml(text);
        return flat && typeof flat === 'object' ? legacyAsSections(flat) : null;
      } catch {
        return null;
      }
    }
    return parseProfile(text).data;
  });
}

// The validated value, once per version of the config. readConfig answers with
// the same object until the file changes, and the value depends on nothing
// else (only the errors read the clock, and no page reads them), so it is kept
// against that object. `null` (no config) cannot key a WeakMap, so it has a slot
// of its own. Callers only read the value or spread it, never change it.
const validated = new WeakMap();
let validatedNull;

function configValue() {
  const meta = readConfig();
  if (meta === null) return (validatedNull ??= validateRecordConfig(null).value);
  let value = validated.get(meta);
  if (value === undefined) {
    value = validateRecordConfig(meta).value;
    validated.set(meta, value);
  }
  return value;
}

// The validated settings, whole. getIdentity() is the name half of this, kept
// separate because three callers want only that.
export function getSettings() {
  return { ...configValue(), path: CONFIG_PATH };
}

// The anchor every dated label in the app measures from. One function, so a page
// and the data behind it cannot disagree about what day it is.
export function getToday() {
  return todayIn(getSettings().timezone);
}

export function getIdentity() {
  // Errors are the build gate's business, not a page's. A typo in the config
  // should not take the record offline — check-profile.mjs --all refuses to
  // ship one, and if one gets through anyway the key reads as absent and the
  // wordmark falls back rather than the route throwing.
  return { name: configValue().name, path: CONFIG_PATH };
}

// The pronouns every sentence in the app that refers to the person is built
// from. Absent from the config, this is "they" — see lib/pronouns.js for why
// that is the right answer rather than a fallback.
export function getPronouns() {
  return pronouns(configValue().pronouns);
}
