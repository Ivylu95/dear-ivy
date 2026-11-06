// Rule test for lib/hazard-log.mjs and its use in git/pre-commit (SFG-010): a
// safety-surface commit needs a new dated entry inside "## The hazard log", not
// anywhere in policies/SAFETY_POLICY.md. Replays 2026-10-05, when three entries
// landed in the "Crisis evaluation results" table above it and the commit gate
// passed them. Run by the hook self-test.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hazardEntryAdded, hazardSection, runRecordOnly, withoutRecord } from '../lib/hazard-log.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const DIV = '| --- | --- | --- | --- | --- | --- |';
const policy = (results, log) =>
  ['# Safety', '', '## Crisis evaluation results', '', '| Date | a | b | c | d | e |', DIV, ...results, '',
    '## The hazard log', '', '| Date | a | b | c | d | e |', DIV, ...log, '', '## After', 'x'].join('\r\n');
const OLD = '| 2026-09-27 | old | h | Low | m | Pass |';
const NEW = '| 2026-10-05 | new | h | Low | m | Pass |';
const before = policy([], [OLD]);

check('an entry inside the hazard log counts', hazardEntryAdded(before, policy([], [NEW, OLD])));
check('the incident: an entry in the results table above it does not', !hazardEntryAdded(before, policy([NEW], [OLD])));
check('the fix: the same row moved into the log counts', hazardEntryAdded(policy([NEW], [OLD]), policy([], [NEW, OLD])));
check('a reworded old entry is not a new dated row unless its line is new', hazardEntryAdded(before, policy([], [OLD.replace('old', 'older')])));
check('prose added to the log, with no dated row, does not count', !hazardEntryAdded(before, policy([], [OLD, 'a note'])));
check('a file with no hazard log never counts', !hazardEntryAdded('', '# Safety\n| 2026-10-05 | x |'));
check('the section stops at the next heading', !hazardSection(policy([], [OLD])).includes('## After'));

// The real policy file still has the section the check reads.
const real = readFileSync(join(here, '..', '..', '..', 'policies', 'SAFETY_POLICY.md'), 'utf8');
check('policies/SAFETY_POLICY.md has a hazard log with dated rows', /^\| \d{4}-\d{2}-\d{2} \|/m.test(hazardSection(real) ?? ''));

// The commit gate uses it, rather than only asking that the file be staged.
const gate = readFileSync(join(here, 'pre-commit'), 'utf8');
check('git/pre-commit calls hazardEntryAdded', /hazardEntryAdded\(/.test(gate));

// A job's run record is not its instructions (2026-10-07 to 17: every claim of the
// check-in was refused for want of a hazard entry, so it never ran).
const JOB = (record, body = 'Step 1. If her last session ended in crisis, stand down.\n') => `---\nevery: 7 days\nruns: anywhere\n${record}---\n${body}`;
const was = JOB('status: ok\nlast_started: 2026-10-10T10:00:00Z\nlast_finished: 2026-10-10T10:05:00Z\nfailures: 0\n');
const claimed = JOB('status: running\nlast_started: 2026-10-17T10:00:00Z\nlast_finished: 2026-10-10T10:05:00Z\nfailures: 0\nlast_runner: cc-routine\n');
check('a claim, which rewrites only the run record, is a record-only change', runRecordOnly(was, claimed));
check('a changed instruction is not, whatever the record does', !runRecordOnly(was, JOB('status: running\n', 'Step 1. Send a cheerful question.\n')));
check('a changed setting in the frontmatter is not', !runRecordOnly(was, was.replace('runs: anywhere', 'runs: local')));
check('a record key written inside the body is not set aside', !runRecordOnly(was, `${was}status: running\n`));
check('a deleted job file is not', !runRecordOnly(was, ''));
check('withoutRecord keeps the rest of the frontmatter', withoutRecord(claimed).startsWith('---\nevery: 7 days\nruns: anywhere\n---\n'));
check('git/pre-commit sets a record-only job change aside with runRecordOnly', /recordChangeOnly = \(f\) => f\.startsWith\('\.claude\/jobs\/'\) && runRecordOnly\(/.test(gate));

process.exit(failed ? 1 : 0);
