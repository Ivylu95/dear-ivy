// The profile, for hooks: read it through the one schema, and migrate a record
// still in the old flat shape.
//
// No dependencies, like everything under hooks/. The schema itself is
// profile-schema.mjs beside this file, which the checks and the dashboard read
// too, so everything reads the file with the same parser (FND-005).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, repoRoot } from './hook.mjs';

import * as schema from './profile-schema.mjs';

export const record = schema;

export const profilePath = (dir) => join(dir, 'PROFILE.yaml');

// Every PROFILE.yaml held to the rules: her record, the sandbox, the invented
// record the dashboard shows, and the blank template a new record is made from.
export const TEMPLATE = join(repoRoot, 'modules', 'core', 'templates', 'first-contact', 'PROFILE.yaml');

export const allProfiles = () =>
  [
    join(repoRoot, 'data', 'PROFILE.yaml'),
    join(repoRoot, 'data-sandbox', 'PROFILE.yaml'),
    join(repoRoot, 'data-sample', 'PROFILE.yaml'),
    join(repoRoot, 'modules', 'core', 'templates', 'first-contact', 'PROFILE.yaml'),
  ].filter((p) => existsSync(p));

// Errors in one file; [] when valid or still in the old shape (which migrates
// at session start rather than failing an edit).
export function profileErrors(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  if (record.isLegacyProfile(text)) return [];
  return record.readProfile(text).errors;
}

// Rewrites an old flat profile in the current shape, keeping the old file in
// archive/ first: nothing is deleted. Returns the archive path, or null when there
// was nothing to migrate.
export function migrateIfLegacy(dir) {
  const path = profilePath(dir);
  // Older still: before PROFILE.yaml, the same keys lived in config.yaml. A
  // record copied in from then (PRD-008) must not be asked what it already
  // knows, so that file is read as the old flat profile and moved to archive/.
  const older = join(dir, 'config.yaml');
  let fromOlder = false;
  if (!existsSync(path) && existsSync(older)) fromOlder = true;
  else if (!existsSync(path)) return null;
  const text = readFileSync(fromOlder ? older : path, 'utf8');
  if (!record.isLegacyProfile(text)) return null;

  const committed = git(['log', '-1', '--format=%cI', '--', fromOlder ? older : path]).trim();
  const savedAt = committed ? new Date(committed) : new Date();
  const stamp = new Date().toISOString().slice(0, 10);
  const archiveDir = join(dir, 'archive');
  mkdirSync(archiveDir, { recursive: true });
  const base = fromOlder ? `config-${stamp}` : `profile-flat-${stamp}`;
  let archived = join(archiveDir, `${base}.yaml`);
  for (let n = 2; existsSync(archived); n += 1) archived = join(archiveDir, `${base}-${n}.yaml`);

  const next = record.migrateLegacyProfile(text, savedAt);
  const { errors } = record.readProfile(next);
  if (errors.length) return null; // Leave the old file standing rather than write a broken one.
  // Superseded, never deleted: config.yaml is moved into archive/ whole; an old
  // flat PROFILE.yaml is copied there before being rewritten in place.
  if (fromOlder) renameSync(older, archived);
  else writeFileSync(archived, text);
  writeFileSync(path, next);
  return archived;
}
