import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Where the harness is, resolved once for the whole app.
//
// The mirror of lib/data-dir.js, and deliberately a separate file from it. That
// one finds `data/` — her record, personal, hers alone. This one finds
// `.claude/` — the instructions, skills, hooks and specs that shape how the
// conversation behaves. Nothing in here is personal and nothing in here is hers;
// it is non-personal code and prose, committed to the repository, written for a
// developer.
//
// They are two resolvers rather than one with an argument because the whole
// privacy model of this app rests on a surface knowing which of the two folders
// it is reading. A single function taking a folder name is one wrong argument
// away from a harness page rendering her journal, and that failure would look
// like a working page.
//
// Same three candidates as the record, same reasoning:
//
//   ../.claude  `npm run dev` from ux/, which is normal.
//   ./.claude   the process started at the repository root instead.
//   env         DEAR_HARNESS, for anything neither of those describes.
//
// Resolved at module load and then fixed. If none exists, HARNESS still points
// at the most likely path; every read then returns null and the harness views
// render their empty states, which is wrong but safe.
function resolveHarnessDir() {
  const candidates = [
    process.env.DEAR_HARNESS,
    join(process.cwd(), '..', '.claude'),
    join(process.cwd(), '.claude'),
  ].filter(Boolean);
  return candidates.find((path) => existsSync(join(path, 'settings.json'))) ?? candidates[1];
}

export const HARNESS = resolveHarnessDir();

// The specs sit beside `.claude/` at the repository root (ARC-008), so they are
// found from it rather than resolved a second time.
export const SPECS = join(dirname(HARNESS), 'specs');
