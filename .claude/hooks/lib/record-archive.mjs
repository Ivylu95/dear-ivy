// SFG-007's second check, as one function: which record files a commit deletes
// without an archived copy. Kept apart from the commit gate so its rule tests
// can run it without running the gate, which runs the tests.

/**
 * status: [[letter, path], ...] from `git diff --cached --name-status -M --diff-filter=AD`.
 * incoming: in a merge, whether the incoming side (MERGE_HEAD) still holds a
 * path; null when no merge is under way. A file the incoming side had already
 * removed is that side's deletion, made and checked in its own commit.
 */
// The save hook's failure flag is a status note on one machine, never her
// words: its removal needs no archived copy (review, 2026-10-16).
const FLAG = /^data\/[^/]+\/state\/PUSH_FAILED\.md$/;

export function lostRecordFiles(status, incoming = null) {
  const archived = new Set(status.filter(([s, f]) => s === 'A' && f.startsWith('data/archive/')).map(([, f]) => f.split('/').pop()));
  return status.filter(([s, f]) =>
    s === 'D' &&
    f.startsWith('data/') &&
    !f.startsWith('data/archive/') &&
    !FLAG.test(f) &&
    !archived.has(f.split('/').pop()) &&
    (incoming === null || incoming(f)));
}
