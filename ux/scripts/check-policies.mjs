// The user-facing policies hold the shape the legal register asks of them.
//
//   node scripts/check-policies.mjs          (runs as part of `npm run check` and the pre-commit gate)
//   node scripts/check-policies.mjs --due    one line: is a review due, and why — for the
//                                            policy-review skill and the heartbeat
//
// dev/specs/legal/policies.md is the register; each rule below names the row it
// carries out. A policy is read by the person the system is kept for, before
// they rely on it, so it is checked like code: a missing section or a stale date
// is a failed build, not a note for later.
//
// ── What it checks ─────────────────────────────────────────────────────────
//
//   POL-001  all three policies exist, and each links to the other two
//   POL-002  the part written for the person opens with a summary, and carries
//            no spec IDs and no inline code (both belong in the developer part)
//   POL-003  an effective date and a last-updated date, valid and not in the
//            future, and a "changes" section
//            Also, where git history is to hand, a last-updated date no earlier than the newest commit that
//            changed what the person reads (the date moved when the text did)
//   POL-004  the privacy policy's sections: what is kept, why, where, how long
//   POL-005  the privacy policy's section on the person's own rights
//   POL-006  the privacy policy names every service that receives what is said
//   POL-007  the safety policy says the system is an AI, and what it is not
//   POL-008  the terms carry their warranty and liability sections, and keep
//            death and personal injury out of the limit
//   POL-009  the terms say who may use the system
//   POL-010  the terms name their governing law
//   POL-011  every row the developer part cites exists (check-links owns this;
//            not repeated here)
//   POL-012  every policy states its legal-review status
//   POL-013  the review tracker is well formed and its dates agree, and every
//            policy tells the person how often it is reviewed, in step with it.
//            An overdue review is REPORTED, not failed: a gate that refused every
//            commit over it would put a six-monthly task ahead of all other work.
//            POL-014 is what raises it — the /dev-mode hook and the heartbeat
//   POL-015  every review row names what it was benchmarked against
//   SAF-002  every crisis number a policy gives is one the crisis script gives,
//            and the safety policy gives all of them
//
// ── What it cannot check ───────────────────────────────────────────────────
//
// That a sentence is true, or that it is good law. Headings and phrases are the
// form of a promise, not its substance; POL-011 and a lawyer's review (POL-012)
// are what stand behind the words. A check that passes here says the policy is
// complete in shape, never that it is right.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spokenNumbers } from '../lib/safety.mjs';
import { readReviewLog } from '../../.claude/hooks/lib/policy-review.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const dir = join(repoRoot, 'policies');
const crisisScript = join(repoRoot, 'CLAUDE.md');

// Everything above this heading is written for the person; everything below it
// is the developer's record of how each promise is kept.
const DEVELOPER_PART = /^##\s+For developers\b/im;

const COMMON = [
  ['POL-002', /^##\s+In short\b/im, 'an "In short" summary as the first section'],
  ['POL-003', /^##\s+Changes to th(?:is|ese)\b/im, 'a "Changes to this …" section'],
  ['POL-001', /^##\s+Contact\b/im, 'a "Contact" section'],
];

const POLICIES = {
  'PRIVACY_POLICY.md': [
    ['POL-004', /^##\s+What is kept\b/im, 'a "What is kept" section'],
    ['POL-004', /^##\s+Why it is kept\b/im, 'a "Why it is kept" section'],
    ['POL-004', /^##\s+Where it is kept\b/im, 'a "Where it is kept …" section'],
    ['POL-004', /^##\s+How long\b/im, 'a "How long …" section'],
    ['POL-005', /^##\s+Your rights\b/im, 'a "Your rights …" section'],
    ['POL-006', /^##\s+Who else\b/im, 'a "Who else …" section naming every service'],
    ['POL-006', /\bAnthropic\b/, 'Anthropic named as a service that receives what is said'],
    ['POL-006', /\bGitHub\b/, 'GitHub named as the service that stores the record'],
  ],
  'SAFETY_POLICY.md': [
    ['POL-007', /\bAI\b/, 'a plain statement that the system is an AI'],
    ['POL-007', /not a (?:therapist|clinician)/i, 'a statement that it is not a therapist or clinician'],
    ['POL-007', /not an emergency service/i, 'a statement that it is not an emergency service'],
    ['POL-007', /not a medical device/i, 'a statement that it is not a medical device'],
    ['SAF-002', /^##\s+If you need help now\b/im, 'an "If you need help now" section'],
  ],
  'TERMS_OF_USE.md': [
    ['POL-007', /not (?:medical|clinical) advice/i, 'a statement that nothing it says is medical advice'],
    ['POL-008', /^##\s+No warranty\b/im, 'a "No warranty" section'],
    ['POL-008', /^##\s+Limits? (?:of|on) liability\b/im, 'a "Limits of liability" section'],
    ['POL-008', /death or personal injury/i, 'death and personal injury kept outside the liability limit'],
    ['POL-009', /^##\s+Who (?:can|may) use\b/im, 'a "Who can use …" section'],
    ['POL-009', /\b18\b/, 'the minimum age'],
    ['POL-010', /^##\s+Governing law\b/im, 'a "Governing law" section'],
  ],
};

const HEADER = {
  effective: /^\*\*Effective:\*\*\s*(\d{4}-\d{2}-\d{2})\s*$/m,
  updated: /^\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})\s*$/m,
  review: /^\*\*Legal review:\*\*\s*\S.*$/m,
};

const review = readReviewLog(join(dir, 'review-log.md'));
if (process.argv.includes('--due')) {
  console.log(review.due ? `policy review: DUE — ${review.dueBecause}` : `policy review: not due until ${review.next} (last ${review.last})`);
  process.exit(0);
}

// What the person reads, without the lines that carry the dates: the part above
// the developer heading, minus the "Last updated" line and the changes section.
// A commit that changes only this is a change to the policy; a move, a merge or a
// change to the developer part is not.
export const readableText = (text) => {
  const cut = text.search(DEVELOPER_PART);
  return (cut === -1 ? text : text.slice(0, cut))
    .replace(HEADER.updated, '')
    .replace(/^##\s+Changes to th(?:is|ese)\b[\s\S]*?(?=^##\s|(?![\s\S]))/im, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// The date of the newest commit that changed what the person reads, or null when
// git cannot say (no repository, as in the commit gate's snapshot, or no history).
// Only commits from this day on are held to it: the dates were set by hand before
// the check existed, and earlier commits that touched the text (path and row-number
// rewrites in the great moves of 2026-10-03) cannot be dated again. A ratchet,
// not a pass: the day is never moved later.
const MOVES_WITH_TEXT_FROM = '2026-10-16';
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
export const lastTextChange = (file) => {
  try {
    const rel = `policies/${file}`;
    const log = git('log', '--no-merges', '--format=%H %cs', '--', rel).trim().split('\n').filter(Boolean);
    for (const line of log) {
      const [hash, date] = line.split(' ');
      if (date < MOVES_WITH_TEXT_FROM) break;
      // The commit that added it is not a change to its text: a copy made from a
      // release starts with one commit holding every file, dated the day it was
      // made, and every policy read as changed that day (release v1.0, 2026-11-06).
      let before;
      try { before = git('show', `${hash}^:${rel}`); } catch { continue; }
      if (readableText(git('show', `${hash}:${rel}`)) !== readableText(before)) return date;
    }
    return null;
  } catch {
    return null;
  }
};

const failures = [];
for (const problem of review.problems) failures.push(`  review-log.md  POL-013  ${problem}`);
const fail = (file, id, message) => failures.push(`  ${file}  ${id}  ${message}`);

const validDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
// Local date, not UTC: a policy dated today in Singapore is not in the future.
const today = new Date().toLocaleDateString('en-CA');

const script = existsSync(crisisScript) ? spokenNumbers(readFileSync(crisisScript, 'utf8')) : null;
const names = Object.keys(POLICIES);

for (const [file, own] of Object.entries(POLICIES)) {
  const path = join(dir, file);
  if (!existsSync(path)) {
    fail(file, 'POL-001', 'is missing');
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const cut = text.search(DEVELOPER_PART);
  const forThePerson = cut === -1 ? text : text.slice(0, cut);

  for (const other of names.filter((n) => n !== file)) {
    if (!forThePerson.includes(`(${other})`)) fail(file, 'POL-001', `does not link to ${other}`);
  }

  const firstSection = /^##\s+(.+)$/m.exec(forThePerson);
  if (!firstSection || !/^In short\b/i.test(firstSection[1])) {
    fail(file, 'POL-002', 'does not open with "In short"');
  }
  for (const [id, pattern, what] of [...COMMON, ...own]) {
    if (!pattern.test(forThePerson)) fail(file, id, `lacks ${what}`);
  }

  const ids = forThePerson.match(/\b[A-Z]{3}-\d{3}\b/g);
  if (ids) fail(file, 'POL-002', `cites ${[...new Set(ids)].join(', ')} in the part written for the person`);
  // Fenced blocks and inline code are the developer's register, not the person's.
  if (/`/.test(forThePerson)) fail(file, 'POL-002', 'carries code formatting in the part written for the person');

  const effective = HEADER.effective.exec(forThePerson)?.[1];
  const updated = HEADER.updated.exec(forThePerson)?.[1];
  if (!effective || !validDate(effective)) fail(file, 'POL-003', 'lacks a valid "**Effective:** YYYY-MM-DD" line');
  if (!updated || !validDate(updated)) fail(file, 'POL-003', 'lacks a valid "**Last updated:** YYYY-MM-DD" line');
  if (effective && updated && updated < effective) fail(file, 'POL-003', 'was last updated before it took effect');
  if (updated && updated > today) fail(file, 'POL-003', `says it was last updated on ${updated}, which is in the future`);
  // The date moves with the text: the newest dated row of the change table is
  // the last-updated date, and no row is dated outside the policy's life.
  const changes = /^##\s+Changes to th(?:is|ese)\b[\s\S]*?(?=^##\s|(?![\s\S]))/im.exec(forThePerson)?.[0] ?? '';
  const rowDates = [...changes.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm)].map((m) => m[1]);
  if (!rowDates.length) fail(file, 'POL-003', 'lists no dated change in its changes table');
  for (const d of rowDates) {
    if (!validDate(d)) fail(file, 'POL-003', `lists a change dated ${d}, which is not a date`);
    else if (effective && d < effective) fail(file, 'POL-003', `lists a change dated ${d}, before it took effect`);
  }
  const newest = rowDates.filter(validDate).sort().at(-1);
  if (updated && newest && updated !== newest) {
    fail(file, 'POL-003', `says it was last updated ${updated}, but its newest listed change is ${newest}`);
  }
  const changedOn = updated && validDate(updated) ? lastTextChange(file) : null;
  if (changedOn && updated < changedOn) {
    fail(file, 'POL-003', `says it was last updated ${updated}, but its text changed in a commit on ${changedOn}`);
  }
  if (!HEADER.review.test(forThePerson)) fail(file, 'POL-012', 'lacks a "**Legal review:**" line');
  const every = /\bat least every (\d+) months\b/i.exec(forThePerson)?.[1];
  if (!every) fail(file, 'POL-013', 'does not tell the person it is reviewed "at least every N months"');
  else if (review.months && Number(every) !== review.months) {
    fail(file, 'POL-013', `says it is reviewed every ${every} months; the tracker says ${review.months}`);
  }

  if (script) {
    const given = spokenNumbers(forThePerson);
    const unknown = [...given].filter((n) => !script.has(n));
    if (unknown.length) {
      fail(file, 'SAF-002', `gives ${unknown.join(', ')}, which the crisis script does not`);
    }
    if (file === 'SAFETY_POLICY.md') {
      const missing = [...script].filter((n) => !given.has(n));
      if (missing.length) fail(file, 'SAF-002', `leaves out ${missing.join(', ')}, which the crisis script gives`);
    }
  }
}

// POL-006 design 3: a service the machinery sends to is named in the privacy
// policy. Each host below is one a script posts to; where any script in the
// copy's code names it, the part written for the person must name the service.
export const SERVICE_HOSTS = [{ host: 'api.telegram.org', service: 'Telegram' }];
export function unnamedServices(policyText, sources) {
  return SERVICE_HOSTS.filter(({ host, service }) => sources.some((s) => s.includes(host)) && !new RegExp(`\\b${service}\\b`).test(policyText));
}
{
  const privacy = join(dir, 'PRIVACY_POLICY.md');
  if (existsSync(privacy)) {
    const text = readFileSync(privacy, 'utf8');
    const cut = text.search(DEVELOPER_PART);
    const sources = [];
    for (const sub of ['ux/scripts', 'ux/lib', '.claude/hooks/lib']) {
      const base = join(repoRoot, sub);
      if (!existsSync(base)) continue;
      for (const name of readdirSync(base)) if (/\.(m?js)$/.test(name) && !/^test-/.test(name)) sources.push(readFileSync(join(base, name), 'utf8'));
    }
    for (const { host, service } of unnamedServices(cut === -1 ? text : text.slice(0, cut), sources)) {
      fail('PRIVACY_POLICY.md', 'POL-006', `does not name ${service}, which the code sends to (${host})`);
    }
  }
}

if (failures.length) {
  console.error('\n  POLICY CHECK FAILED — dev/specs/legal/policies.md\n');
  console.error(failures.join('\n'));
  console.error('\n  Fix the policy, not the check. A rule that looks wrong is raised with the developer.\n');
  process.exit(1);
}

console.log(`policy check: ${names.length} policies complete in shape${script ? `, crisis numbers in step (${script.size})` : ''}`);
console.log(review.due
  ? `  NOTE  a policy review is due: ${review.dueBecause}. Run the policy-review skill (POL-014).`
  : `policy check: next review due ${review.next}`);
