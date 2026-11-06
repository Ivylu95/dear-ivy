// Where this copy's harness releases come from: the release repository's address.
//
// The address names its owner (a GitHub account), so it lives in the record, at
// data/core/setup/release-source.json, and the harness file .claude/release/source.json
// holds a placeholder (A-155, the owner's yes, 2026-11-01: "Okay, move it"). The
// record's file is read first; the harness file is read after it, for a copy whose
// address was pinned there before the move. Always the real record, data/, never a
// chat's sandbox: where releases come from is the machine's, not a test chat's.
// A value holding `<` is a placeholder and counts as unset.
//
// No imports beyond node's own: the updater runs this from a release candidate,
// and pre-push from any checkout.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The record's file, from the repository root. */
export const RECORD_SOURCE = 'data/core/setup/release-source.json';
/** The harness file, from the repository root: a placeholder once the address moved. */
export const HARNESS_SOURCE = '.claude/release/source.json';

const repoIn = (path) => {
  try {
    const repo = JSON.parse(readFileSync(path, 'utf8'))?.repo;
    return typeof repo === 'string' && repo.trim() && !repo.includes('<') ? repo.trim() : '';
  } catch {
    return '';
  }
};

/** The release repository's address for the copy at `root`, or '' when none is set. */
export function releaseRepo(root) {
  return repoIn(join(root, RECORD_SOURCE)) || repoIn(join(root, HARNESS_SOURCE));
}
