// Stop — two safety checks at the end of every turn. policies/SAFETY_POLICY.md.
//
// 1. THE WAY TO HELP STILL WORKS. The crisis numbers in the safety plan still
//    parse, and every number the crisis script speaks is in it
//    (ux/scripts/check-safety.mjs, no dependencies, ~60ms). It used to run only
//    in `npm run check` and the build, which can be days after the change that
//    broke it. SAF-002, "Help is always within reach, and the way to it works."
//
// 2. NO SAFETY-SURFACE CHANGE WITHOUT A HAZARD ASSESSMENT. When a file on the
//    safety surface changed since the last turn and the hazard log in
//    policies/SAFETY_POLICY.md did not, the turn does not end quietly: step 2 of
//    the policy's change process, made mechanical instead of a promise. SFG-010,
//    "A change to what a person in distress is told carries a dated hazard
//    assessment before it ships."
//
// Neither refuses an edit; both report at the end of the turn, once.
// Every message says to stay with her first if she is in crisis: a check that
// pulls the model away from someone in distress to fix a file is itself the
// hazard (first entry in the hazard log).

import { readHookInput, block, pass, repoRoot, read, existsFile, markerRead, markerWrite } from '../lib/hook.mjs';
import { touchedBy, isTouched } from '../lib/touched.mjs';
import { withoutRecord } from '../lib/hazard-log.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const input = await readHookInput();
if (input?.stop_hook_active) pass();

const CRISIS_FIRST = 'If she is in crisis or distressed, stay with her and do this afterwards: safety of the person comes before the safety of the files.';

// ── 1. the crisis numbers ───────────────────────────────────────────────────
const numbers = join(repoRoot, 'ux', 'scripts', 'check-safety.mjs');
if (existsFile(numbers)) {
  const run = spawnSync(process.execPath, [numbers], { cwd: join(repoRoot, 'ux'), encoding: 'utf8', timeout: 20000, windowsHide: true });
  if (run.status !== 0) {
    block(
      `SAFETY CHECK FAILED: the crisis numbers do not check out. Fix this before any other harness work. ${CRISIS_FIRST}\n\n${(run.stderr || run.stdout || 'the check did not finish').trim()}`,
    );
  }
}

// ── 2. the safety surface ───────────────────────────────────────────────────
// What decides what a person in distress is told, when a conversation ends, and
// what is remembered about a bad night. The policy names it; this is its list.
// Kept in step with SURFACE in hooks/git/pre-commit, which checks the same at
// every commit.
const SURFACE = [
  'CLAUDE.md',
  'AGENTS.md',
  '.claude/hooks/safety',
  '.claude/skills/first-contact',
  '.claude/jobs/check-in.md',
  'dev/specs/interaction/safety.md',
  'ux/lib/safety.mjs',
  'ux/scripts/check-safety.mjs',
];

function fingerprint(paths) {
  const parts = [];
  const visit = (abs) => {
    let st;
    try {
      st = statSync(abs);
    } catch {
      parts.push(`${relative(repoRoot, abs)}:gone`);
      return;
    }
    if (st.isDirectory()) for (const name of readdirSync(abs).sort()) visit(join(abs, name));
    // Content, not timestamps: a checkout or a touch that changes nothing is not a change.
    // A job file is hashed without its run record, which every claim and finish rewrites.
    else {
      const rel = relative(repoRoot, abs).replace(/\\/g, '/');
      const body = rel.startsWith('.claude/jobs/') ? withoutRecord(readFileSync(abs, 'utf8')) : readFileSync(abs);
      parts.push(`${rel}:${createHash('sha1').update(body).digest('hex')}`);
    }
  };
  for (const p of paths) visit(join(repoRoot, p));
  return parts;
}

const hazardLog = () => {
  const text = read(join(repoRoot, 'policies', 'SAFETY_POLICY.md'));
  const at = text.indexOf('## The hazard log');
  return at === -1 ? '' : text.slice(at);
};

// The log is kept as its fingerprint, not its text: a copy of the whole log was
// rewritten into the state file at every Stop and grew with every entry (162 KB on
// 2026-10-31, A-147). Any change to the log changes its fingerprint, so what this
// sees is the same. A state file from before keeps the text; it is fingerprinted
// here to compare, so the change of form never reads as a new entry.
const sha1 = (t) => createHash('sha1').update(String(t)).digest('hex');
const logPrint = (stored) => (/^[0-9a-f]{40}$/.test(String(stored)) ? String(stored) : sha1(stored ?? ''));

const MARKER = 'safety-surface.json';
const now = { surface: fingerprint(SURFACE), log: sha1(hazardLog()) };
let seen = null;
try {
  seen = JSON.parse(markerRead(MARKER) || 'null');
} catch {
  seen = null;
}

// The first turn on a machine sets the baseline; there is nothing to compare yet.
if (!seen) {
  markerWrite(MARKER, JSON.stringify(now));
  pass();
}

const before = new Set(seen.surface);
const changed = now.surface.filter((p) => !before.has(p)).map((p) => p.split(':')[0]);
if (!changed.length || now.log !== logPrint(seen.log)) {
  markerWrite(MARKER, JSON.stringify(now));
  pass();
}

// Whose change it is. Sessions share one tree, and blocking every session for
// another's surface change taught them all to wave this gate through (hazard
// log, 2026-09-27). A change this session did not touch passes here without
// being marked seen, so the session that made it is still asked at its own
// stop; and the pre-commit gate refuses any commit touching the surface without
// a hazard entry, whoever wrote it. That is the backstop that keeps every true
// case caught.
const mine = touchedBy(input?.session_id);
const ours = changed.filter((f) => isTouched(mine, f));
if (!ours.length) pass();

// Not recorded as seen: until the log gains an entry, every turn asks again.
block(
  [
    'SAFETY GATE: files on the safety surface changed and the hazard log did not.',
    '',
    ...[...new Set(ours)].map((f) => `  - ${f}`),
    '',
    'Add one entry, newest first, to "The hazard log" in policies/SAFETY_POLICY.md: date, the change, what could now go wrong for a person in distress, severity, the mitigation, and the test run with its result. Non-personal words only. If the change weakens or removes a safeguard, say so first. (Change process, step 2.)',
    '',
    CRISIS_FIRST,
  ].join('\n'),
);
