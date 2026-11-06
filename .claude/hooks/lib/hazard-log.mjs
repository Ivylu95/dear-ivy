// SFG-010's entry, found where it counts: inside "## The hazard log" of
// policies/SAFETY_POLICY.md, not merely somewhere in that file.
//
// The commit gate once asked only that the policy file be staged. On 2026-10-05
// three entries were inserted after the first six-column table divider in the
// file, which belongs to "Crisis evaluation results", and three safety-surface
// commits passed with the log itself unchanged. Only the end-of-turn gate, which
// reads the section, noticed.

// The hazard log's section of the policy text: from its heading to the next
// level-two heading, or null when the file has no such section.
export function hazardSection(text) {
  const t = String(text ?? '').replace(/\r\n/g, '\n');
  const at = t.search(/^## The hazard log\s*$/m);
  if (at < 0) return null;
  const rest = t.slice(at);
  const next = rest.slice(1).search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

// Whether `after` holds a dated entry in its hazard log that `before`'s log did
// not: a row that opens `| YYYY-MM-DD |`. A row moved in from elsewhere in the
// file counts, since it is new to the log.
export function hazardEntryAdded(before, after) {
  const now = hazardSection(after);
  if (now === null) return false;
  const was = new Set((hazardSection(before) ?? '').split('\n'));
  return now.split('\n').some((line) => /^\| \d{4}-\d{2}-\d{2} \|/.test(line) && !was.has(line));
}

// A heartbeat's own record is not its instructions. `.claude/jobs/check-in.md` is on
// the safety surface for what the run is told to do; the lines at the top that
// `heartbeats.mjs` rewrites on every claim and finish (HBT-004, HBT-011) say only
// when it ran and who ran it. From 2026-10-07 every claim of the check-in was refused
// for want of a hazard entry, so it never ran. These keys, and only these, are set
// aside; any other change to the file still counts as a change to the surface.
export const RECORD_KEYS = ['status', 'last_started', 'last_finished', 'failures', 'last_runner'];

// The file with its frontmatter's record lines removed.
export function withoutRecord(text) {
  const t = String(text ?? '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(t);
  if (!m) return t;
  const kept = m[1].split('\n').filter((line) => !RECORD_KEYS.some((k) => line.startsWith(`${k}:`)));
  return `---\n${kept.join('\n')}\n---\n${t.slice(m[0].length)}`;
}

// Whether two versions of a job file differ only in its record lines.
export const runRecordOnly = (before, after) => withoutRecord(before) === withoutRecord(after);
