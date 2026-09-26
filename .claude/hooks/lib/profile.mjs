// The profile, for hooks: read it through the one schema, and migrate a record
// still in the old flat shape.
//
// No dependencies, like everything under hooks/. The schema itself is
// profile-schema.mjs beside this file, which the checks and the dashboard read
// too, so everything reads the file with the same parser (ARC-013).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, repoRoot } from './hook.mjs';

import * as schema from './profile-schema.mjs';

export const record = schema;

export const profilePath = (dir) => join(dir, 'profile.yaml');

// Every profile.yaml held to the rules: her record, the sandbox, the invented
// record the dashboard shows, and the blank template a new record is made from.
export const TEMPLATE = join(repoRoot, '.claude', 'skills', 'first-contact', 'templates', 'profile.yaml');

export const allProfiles = () =>
  [
    join(repoRoot, 'data', 'profile.yaml'),
    join(repoRoot, 'data-sandbox', 'profile.yaml'),
    join(repoRoot, 'samples', 'profile.yaml'),
    join(repoRoot, '.claude', 'skills', 'first-contact', 'templates', 'profile.yaml'),
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
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  if (!record.isLegacyProfile(text)) return null;

  const committed = git(['log', '-1', '--format=%cI', '--', path]).trim();
  const savedAt = committed ? new Date(committed) : new Date();
  const stamp = new Date().toISOString().slice(0, 10);
  const archiveDir = join(dir, 'archive');
  mkdirSync(archiveDir, { recursive: true });
  let archived = join(archiveDir, `profile-flat-${stamp}.yaml`);
  for (let n = 2; existsSync(archived); n += 1) archived = join(archiveDir, `profile-flat-${stamp}-${n}.yaml`);
  writeFileSync(archived, text);

  const next = record.migrateLegacyProfile(text, savedAt);
  const { errors } = record.readProfile(next);
  if (errors.length) return null; // Leave the old file standing rather than write a broken one.
  writeFileSync(path, next);
  return archived;
}
