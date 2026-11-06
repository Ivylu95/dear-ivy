#!/usr/bin/env node
// What is set up in this copy, what is missing and what is broken, read from
// evidence rather than asked (DEP-014). The `set-up` skill runs it first, in
// every mode, so a check, a setup and a repair all start from the same picture.
//
//   node ux/scripts/setup-doctor.mjs           a table
//   node ux/scripts/setup-doctor.mjs --json    the same, for the skill to read
//   node ux/scripts/setup-doctor.mjs --fetch   fetch origin first, so the save
//                                              evidence is current, and read the
//                                              secrets and the Actions minutes from
//                                              GitHub's run logs
//
// Read-only: it changes nothing, and prints nothing written in the record; only
// states, counts, dates and her own settings (such as whether the check-in nudge is on). What
// only claude.ai or a phone can show, or GitHub when `gh` cannot read
// it, is listed as `unknown`, with the check the agent makes there (`remote`).
//
// States: ok · broken · missing · unknown (look elsewhere, or a person must look)
// · paused (held on purpose for now) · off (chosen not to have)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { hasToken } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks', 'lib', 'update', 'secrets.mjs')).href);
const { releaseRepo } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks', 'lib', 'release-source.mjs')).href);
const { threshold } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks', 'lib', 'thresholds.mjs')).href);

// CODE is this harness; ROOT is the copy being read, the same unless a test points
// SETUP_DOCTOR_ROOT at a throwaway one.
const CODE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = process.env.SETUP_DOCTOR_ROOT || CODE;
const at = (...p) => join(ROOT, ...p);
const lib = (...p) => pathToFileURL(join(CODE, ...p)).href;
const read = (...p) => {
  try {
    return readFileSync(at(...p), 'utf8');
  } catch {
    return null;
  }
};
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const has = (cmd) => {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** One finding. `who`: agent (it can act), person (a person must), remote (check elsewhere). */
const item = (id, area, label, state, evidence, next = '', who = 'agent') => ({ id, area, label, state, evidence, next, who });

export function environment(env = process.env, fetched = false) {
  const cloud = Boolean(env.CLAUDE_CODE_REMOTE_SDK_URL || env.CCR_AGENT_PROXY_ENABLED || env.CLAUDE_CODE_REMOTE);
  return {
    where: cloud ? 'cloud session' : 'local machine',
    platform: process.platform,
    // No origin: the README's download has run and setup has not reached step 8.
    copy: !git(['remote', 'get-url', 'origin']) ? 'new' : existsSync(at('dev')) ? 'developer' : 'person',
    node: process.versions.node,
    tools: Object.fromEntries(['git', 'gh', 'npx'].map((t) => [t, has(t)])),
    fetched,
  };
}

function history() {
  const shallow = git(['rev-parse', '--is-shallow-repository']);
  if (shallow === null) return item('history', 'repo', 'Git history', 'broken', 'not a git checkout', 'clone the repository', 'person');
  return shallow === 'true'
    ? item('history', 'repo', 'Git history', 'broken', 'shallow clone: the commit gate cannot see older commits', 'git fetch --unshallow origin')
    : item('history', 'repo', 'Git history', 'ok', 'full history');
}

/** An address whose host is GitHub, with an optional user before it: https, ssh or scp-like. */
export const GITHUB = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?(?:www\.)?github\.com[:/]([^/]+)\/([^/]+?)\/?$/i;

function remote() {
  const url = git(['remote', 'get-url', 'origin']);
  if (!url) return item('remote', 'repo', 'Repository on GitHub', 'missing', 'no origin remote', 'new-copy.md step 1', 'person');
  // A token written into the address is kept in .git/config in the clear and shown by any
  // `git remote -v`; the address itself is never printed here (set-up edge cases, 2026-10-29).
  // Only a secret counts: a password after a name (`//name:secret@`) or a token's own
  // shape. A bare user name (`https://<user>@github.com/…`) is no credential, and once
  // read ❌ (round 2, C20).
  // A classic token is 40 hex characters, which hasToken's shapes do not cover; alone
  // before the host it once read ok (round 3, C11).
  if (/\/\/[^/@:]+:[^/@]+@/.test(url) || hasToken(url) || /\/\/[0-9a-f]{40}@/i.test(url)) {
    return item('remote', 'repo', 'Repository on GitHub', 'broken', 'the origin address carries a credential, kept in the clear in this copy\'s git settings', 'set origin to the plain https://github.com/<owner>/<repo>.git address (git remote set-url origin …), then revoke that token on GitHub and make a new one if it is still needed', 'person');
  }
  // The host itself must be GitHub: `https://evil.example/github.com/…` or a folder
  // named github.com once read ✅ (round 2, C20; the pre-push guard's C3 pattern).
  return GITHUB.test(url)
    ? item('remote', 'repo', 'Repository on GitHub', 'ok', 'origin is on GitHub')
    : item('remote', 'repo', 'Repository on GitHub', 'broken', 'origin is not GitHub', 'new-copy.md step 1', 'person');
}

function hooks() {
  const path = git(['config', 'core.hooksPath']);
  return path === '.claude/hooks/git'
    ? item('hooks', 'repo', 'Commit gate', 'ok', 'core.hooksPath is .claude/hooks/git')
    : item('hooks', 'repo', 'Commit gate', 'missing', path ? `core.hooksPath is ${path}` : 'core.hooksPath not set', 'git config core.hooksPath .claude/hooks/git');
}

/** Record paths a branch changes that main lacks, leaving out the push-failed note. */
const MARKER = 'data/core/state/PUSH_FAILED.md';

/**
 * Branches on origin that main does not hold, sorted by what they need. A session
 * branch or a rescue saved from main or a session is the merge workflow's to carry;
 * any other branch touching the record (a rescue from a detached or development
 * checkout, or a branch by any other name) may hold harness work or a superseded save,
 * and waits for a person (.claude/memory/unpushed-saves-may-already-be-safe.md). A
 * branch of another name once hid record changes behind "Saves reach main" (2026-10-29).
 */
export function saveEvidence() {
  const refs = (git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin']) ?? '').split('\n').filter(Boolean);
  const main = refs.includes('origin/main') ? 'origin/main' : null;
  if (!main) return null;
  const ahead = (ref) => Number(git(['rev-list', '--count', `${main}..${ref}`]) ?? 0) > 0;
  const recordFiles = (ref) => (git(['diff', '--name-only', `${main}...${ref}`, '--', 'data/']) ?? '').split('\n').filter((f) => f && f !== MARKER);
  const open = refs.filter((r) => (r.startsWith('origin/claude/') || r.startsWith('origin/rescue/')) && ahead(r));
  const carried = (r) => r.startsWith('origin/claude/') || /^origin\/rescue\/(main|claude)-/.test(r);
  const others = refs.filter((r) => r.startsWith('origin/') && r !== main && r !== 'origin/HEAD' && !open.includes(r) && !r.startsWith('origin/claude/') && !r.startsWith('origin/rescue/') && ahead(r));
  const withRecord = [...open, ...others].filter((r) => recordFiles(r).length);
  return {
    carry: withRecord.filter(carried).map((r) => r.replace('origin/', '')),
    look: withRecord.filter((r) => !carried(r)).map((r) => r.replace('origin/', '')),
    leftovers: open.filter((r) => r.startsWith('origin/rescue/') && !recordFiles(r).length).length,
    landed: Number(git(['rev-list', '--count', '--merges', '-E', '--grep=claude/|merge a session branch|merge a rescued save', main]) ?? 0),
  };
}

/**
 * Why the last save failed, from the note's first line and the save hook's own fixed
 * wording only, never a word of anything else (round 3, B1). A note headed
 * RECORD NOT COMMITTED is a commit that failed, which no push retry mends.
 */
export function noteCause(note) {
  const text = String(note ?? '');
  if (!/^RECORD NOT COMMITTED\b/.test(text)) return null;
  if (/a git merge is stopped partway/.test(text)) return 'a merge stopped partway';
  if (/held its lock \(index\.lock\)/.test(text)) return 'git\'s lock (index.lock) was held';
  if (/could not add a new record file/.test(text)) return 'a new record file git could not add';
  return 'git refused the commit';
}

/** Whether a git process is running on this machine: true, false, or null when it cannot be told. */
function gitRunning() {
  try {
    const names = process.platform === 'win32'
      ? execFileSync('tasklist', ['/fo', 'csv', '/nh'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').map((l) => l.split(',')[0].replace(/"/g, '').toLowerCase())
      : execFileSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').map((l) => l.trim().split('/').pop());
    return names.some((n) => n === 'git' || n === 'git.exe');
  } catch {
    return null;
  }
}

/** A lock git left behind refuses every save, and only a person may remove it (round 3, B1). */
function lockItem() {
  const rel = git(['rev-parse', '--git-path', 'index.lock']);
  if (!rel) return null;
  const lock = /^(\/|[A-Za-z]:)/.test(rel) ? rel : join(ROOT, rel);
  if (!existsSync(lock)) return null;
  const running = gitRunning();
  if (running) return item('lock', 'saves', 'Git lock', 'unknown', 'git\'s lock (index.lock) is held, and a git is running here', 'wait for it to finish, then look again');
  return item('lock', 'saves', 'Git lock', 'broken', `git's lock (index.lock) is left behind${running === false ? ' with no git running' : ''}, so every save is refused`, 'a person removes .git/index.lock by hand once no git is running (repair-push.md); the next turn saves', 'person');
}

function saves(fetched) {
  const out = [];
  const stale = fetched ? '' : ' (branches as of the last fetch; run with --fetch)';
  const note = existsSync(at(...MARKER.split('/'))) ? (read(...MARKER.split('/')) ?? '') : null;
  const cause = noteCause(note);
  // Main ahead of GitHub with record commits and no note: those saves are on this
  // computer only, which once read "push ok" (round 3, B19).
  const head = git(['rev-parse', '--verify', '-q', 'refs/heads/main']) ? 'refs/heads/main' : 'HEAD';
  const unpushed = git(['rev-parse', '--verify', '-q', 'refs/remotes/origin/main']) ? Number(git(['rev-list', '--count', `origin/main..${head}`, '--', 'data/']) ?? 0) : 0;
  if (cause) out.push(item('push', 'saves', 'Last save reached GitHub', 'broken', `the last save was not committed: ${cause}`, 'repair-push.md: a commit that failed, not a push: settle its cause, and the next turn saves'));
  else if (note !== null) out.push(item('push', 'saves', 'Last save reached GitHub', 'broken', 'a push-failed note is in the record', 'repair-push.md: retry the push; the note clears itself once one lands'));
  else if (unpushed > 0) out.push(item('push', 'saves', 'Last save reached GitHub', 'broken', `${unpushed} record commit(s) not on GitHub${stale}`, 'repair-push.md: push main; nothing else holds them'));
  else out.push(item('push', 'saves', 'Last save reached GitHub', 'ok', 'no push-failed note'));
  const lock = lockItem();
  if (lock) out.push(lock);
  const ev = saveEvidence();
  if (!ev) {
    out.push(item('carry', 'saves', 'Saves reach main', 'unknown', 'no origin/main here; run with --fetch', 'remote: Actions tab, merge-sessions runs', 'remote'));
    return out;
  }
  if (ev.carry.length) {
    out.push(item('carry', 'saves', 'Saves reach main', 'broken', `${ev.carry.length} session or rescue branch(es) hold record changes main lacks${stale}`, 'repair.md, Saves stuck on a branch: read the merge-sessions run log first; a 403 is the Actions write permission (new-copy-finish.md step 10), a CONFLICT is a merge to hand over'));
  } else if (ev.landed > 0) {
    out.push(item('carry', 'saves', 'Saves reach main', 'ok', `session saves have been merged into main${stale}`));
  } else {
    out.push(item('carry', 'saves', 'Saves reach main', 'unknown', `no session branch has landed yet${stale}`, 'new-copy-close.md step 13: one phone conversation, then look again', 'person'));
  }
  if (ev.look.length) out.push(item('rescue', 'saves', 'Branches to look at', 'unknown', `${ev.look.length} branch(es) main lacks, other than a session save, touch the record${stale}`, 'repair.md, Saves stuck on a branch: may be superseded or hold harness work; never merged without a look', 'person'));
  if (ev.leftovers) out.push(item('leftovers', 'saves', 'Branches with no record change', 'unknown', `${ev.leftovers} branch(es) main lacks, none touching the record${stale}`, 'they may hold harness work: look at each before any tidying (git-reconcile)', 'person'));
  return out;
}

function workflows() {
  const f = (n) => existsSync(at('.github', 'workflows', n));
  return [
    f('merge-sessions.yml')
      ? item('merge-workflow', 'saves', 'Merge workflow', 'ok', '.github/workflows/merge-sessions.yml present')
      : item('merge-workflow', 'saves', 'Merge workflow', 'missing', 'no merge-sessions.yml', 'restore it from history in one commit, from a computer (components.md, merge-workflow)', 'person'),
    f('check-in.yml') && f('heartbeats.yml')
      ? item('heartbeat-workflows', 'telegram', 'Heartbeat workflows', 'ok', 'check-in.yml and heartbeats.yml present')
      : item('heartbeat-workflows', 'telegram', 'Heartbeat workflows', 'missing', 'check-in.yml or heartbeats.yml absent', 'telegram.md step 15.2', 'person'),
  ];
}

// What wears out on its own (DEP-014 design 1). Setup writes each token's end in
// the setup notes as `- expires · YYYY-MM-DD · what`; one already past, or inside
// the warning window, reads broken before it stops anything. The window is a
// threshold; unreadable, nothing is judged early, only what has already passed.
export function expiries(notes, today = new Date().toISOString().slice(0, 10), pipe = false) {
  // Every `- expires` line counts: one unpadded (2026-9-1), with a double space or with no
  // `· what` was once dropped silently, hiding a token already past (round 3, C10). A line
  // off the strict form reads unreadable, never absent.
  const all = [...(notes ?? '').matchAll(/^-\s*expires\b.*$/gim)].map(([line]) => {
    const m = line.match(/^- expires · (\d{4}-\d{2}-\d{2}) · (.+)$/);
    return m ? { date: m[1], what: m[2].trim() } : { date: 'unreadable', what: '' };
  });
  // A date no calendar has (2026-13-01) once read as far off and ✅ (2026-10-29): it is
  // unreadable, so nothing about that token is known.
  const real = (date) => !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  // The unreadable ones are said alongside, never instead: one bad line once hid a key
  // that had already expired (round 2, C18).
  const bad = all.filter((e) => !real(e.date));
  const unread = bad.length ? [item('expiry-date', 'telegram', 'Token ends that cannot be read', 'unknown', `${bad.length} token end(s) in the setup notes is not a real date in the form \`- expires · YYYY-MM-DD · which token\``, 'find that token\'s end on the owner\'s account and correct its `- expires · YYYY-MM-DD · which token` line in data/core/state/setup_notes.md', 'person')] : [];
  return [...judgeEnds(all.filter((e) => real(e.date)), today, pipe && !bad.length), ...unread];
}

function judgeEnds(ends, today, pipe) {
  // Heartbeats laid but no end written: the tokens exist and nothing will warn.
  if (!ends.length) return pipe ? [item('expiry', 'telegram', 'Tokens that expire', 'unknown', 'no token end is written in the setup notes', 'write each as `- expires · YYYY-MM-DD · which token` in data/core/state/setup_notes.md (telegram.md, step 15)', 'person')] : [];
  const warn = threshold('setUp.expiryWarnDays', 'days') ?? 0;
  const days = (date) => Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  const soon = ends.filter((e) => days(e.date) <= warn).sort((a, b) => a.date.localeCompare(b.date));
  if (!soon.length) {
    const next = ends.map((e) => e.date).sort()[0];
    return [item('expiry', 'telegram', 'Tokens that expire', 'ok', `${ends.length} recorded; the next ends ${next}`)];
  }
  const said = soon.map((e) => (days(e.date) < 0 ? `${e.what} ended ${e.date}` : `${e.what} ends ${e.date}`)).join('; ');
  return [item('expiry', 'telegram', 'Tokens that expire', 'broken', said, 'renew it on the owner\'s account (telegram.md, step 15), then update its line in data/core/state/setup_notes.md', 'person')];
}

/**
 * A country's entry in the crisis-lines catalogue: its section's `first` and
 * `emergency` numbers, each with a source and a checked date, or null.
 */
export function crisisEntry(catalogue, country) {
  if (!catalogue) return null;
  const esc = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = catalogue.split(/^## /m).find((part) => new RegExp(`^${esc}\\s*$`, 'im').test(part.split('\n')[0]));
  if (!section) return null;
  const row = (role) => section.split('\n').map((l) => l.split('|').map((c) => c.trim())).find((c) => c[1] === role && c[3] && c[5] && /\d{4}-\d{2}-\d{2}/.test(c[7] ?? ''));
  const first = row('first');
  const emergency = row('emergency');
  return first && emergency ? { first: first[3].split(' (')[0], emergency: emergency[3] } : null;
}

/** What the doctor says when the copy cannot be set up: the recorded country has no checked crisis lines. */
const FAILED = 'crisis numbers not set for this country';
/** The Singapore numbers CLAUDE.md ships, which a plan written before a catalogue change may still hold. */
const SHIPPED_SG = ['1767', '9151 1767', '1771', '6669 1771'];

/** A copy made for someone else carries no dev/ (DEP-013); new-copy.mjs removes it and writes `- for · someone else`. */
function copyFor() {
  const said = read('data', 'core', 'state', 'setup_notes.md')?.match(/^- for · (.+)$/m)?.[1].trim();
  if (said !== 'someone else') return [];
  return existsSync(at('dev'))
    ? [item('copy-for', 'repo', 'A copy for someone else', 'broken', 'marked as someone else\'s, and dev/ is present: her chats would run with development rights', 'remove dev/ from it in one commit, and find how it came back (new-copy-download.md steps 3 to 5)', 'person')]
    : [item('copy-for', 'repo', 'A copy for someone else', 'ok', 'marked as someone else\'s, with no dev/')];
}

async function record() {
  const out = [];
  const profile = read('data', 'PROFILE.yaml');
  if (profile === null) {
    out.push(item('profile', 'record', 'Profile', 'missing', 'no data/PROFILE.yaml', 'the README download (new-copy-download.md steps 3 to 5)'));
  } else {
    const { parseProfile } = await import(lib('.claude', 'hooks', 'lib', 'profile-schema.mjs'));
    const { data } = parseProfile(profile);
    const owed = ['mandatory', 'recommended'].flatMap((s) => Object.values(data?.[s] ?? {})).filter((q) => q?.status === 'not_asked').length;
    out.push(owed
      ? item('profile', 'record', 'Profile', 'missing', `${owed} question(s) not yet asked`, 'first-contact asks them in her own conversation', 'person')
      : item('profile', 'record', 'Profile', 'ok', 'every mandatory and recommended question raised'));
  }
  const plan = read('data', 'safety', 'safety_plan.md');
  let timeZone = '';
  if (profile !== null) {
    const { readProfile } = await import(lib('.claude', 'hooks', 'lib', 'profile-schema.mjs'));
    timeZone = readProfile(profile).value?.timezone ?? '';
  }
  const shipped = plan !== null && /1767/.test(plan);
  const inSingapore = timeZone === 'Asia/Singapore';
  const notes = read('data', 'core', 'state', 'setup_notes.md');
  // Where she lives, written early in a new copy as `- country · <country>`. A
  // country is set up only once the crisis-lines catalogue has a checked entry
  // for it (SAF-016): its first route and emergency number, sourced and dated.
  // Anywhere else is a hard stop. Outside Singapore her plan must also hold that
  // entry's first route, since CLAUDE.md gives the plan's lines over the default.
  const country = notes?.match(/^- country · (.+)$/m)?.[1].trim();
  const sg = country && /^(singapore|sg)$/i.test(country);
  const entry = country ? crisisEntry(read('modules', 'core', 'knowledge', 'crisis-lines.md'), sg ? 'Singapore' : country) : null;
  if (country && !entry) out.push(item('safety-plan', 'record', 'Crisis numbers', 'broken', FAILED, 'a hard stop: the setup cannot finish, and her first conversation waits, until modules/core/knowledge/crisis-lines.md has a checked entry for that country (SAF-016)', 'person'));
  else if (country && !sg && plan !== null && !plan.includes(entry.first)) out.push(item('safety-plan', 'record', 'Crisis numbers', 'broken', FAILED, "her safety plan does not yet hold her country's lines from the catalogue: new-copy-download.md step 7", 'person'));
  else if (plan === null) out.push(item('safety-plan', 'record', 'Crisis numbers', 'missing', 'no safety plan', 'new-copy-download.md step 7', 'person'));
  // Singapore's numbers ship in CLAUDE.md, so her plan need not hold them; but a plan
  // that does hold Singapore lines (the catalogue's or the shipped ones) must hold the
  // catalogue's current first line, or a changed line would leave her plan behind it
  // unnoticed (SAF-017, the unlock of 2026-11-03).
  else if (sg && entry && [entry.first, entry.emergency, ...SHIPPED_SG].some((n) => plan.includes(n)) && !plan.includes(entry.first)) out.push(item('safety-plan', 'record', 'Crisis numbers', 'broken', "her safety plan holds Singapore lines, but not the catalogue's current first line", 'copy the line from modules/core/knowledge/crisis-lines.md into her plan, keeping the old one in data/archive/', 'person'));
  else if (country) out.push(item('safety-plan', 'record', 'Crisis numbers', 'ok', "the recorded country has a checked entry, and her plan holds its lines"));
  // A copy made by new-copy (`- for ·`) whose country was never asked: her profile's
  // timezone is Singapore's by default, never asked, so it proves nothing here (2026-10-29).
  else if (/^- for · /m.test(notes ?? '')) out.push(item('safety-plan', 'record', 'Crisis numbers', 'unknown', 'no country is recorded for this copy yet', 'ask the country (new-copy-run.md, Before the first step) and write `- country · <country>` in data/core/state/setup_notes.md; outside Singapore the setup stops until its lines are checked; in her chat, a setup note instead', 'person'));
  else if (!shipped) out.push(item('safety-plan', 'record', 'Crisis numbers', 'ok', 'numbers edited for her place'));
  else if (inSingapore) out.push(item('safety-plan', 'record', 'Crisis numbers', 'ok', "the shipped Singapore numbers, and her profile's timezone is Singapore's"));
  else out.push(item('safety-plan', 'record', 'Crisis numbers', 'unknown', `the shipped Singapore numbers, and her timezone is ${timeZone || 'not set'}`, 'ask which country she lives in and write `- country · <country>` in data/core/state/setup_notes.md (new-copy-run.md, Before the first step); outside Singapore the setup stops; in her chat, a setup note instead', 'person'));
  const open = notes ? (notes.match(/^- open ·/gm) ?? []).length : 0;
  if (open) out.push(item('setup-notes', 'record', 'Setup notes waiting', 'unknown', `${open} note(s) left for whoever checks the setup`, 'read data/core/state/setup_notes.md; check each against this report, settle it, then move its line to data/archive/setup_notes.md as done', 'agent'));
  out.push(...expiries(notes, undefined, existsSync(at('.github', 'workflows', 'heartbeats.yml'))));
  return out;
}

/** An hourly routine with no finish run for this long has stopped. */
const ROUTINE_QUIET_MS = 24 * 3600e3;

async function nudgeOn() {
  if (read('data', 'core', 'me', 'nudge.md') === null) return false;
  try {
    const { switchedOn } = await import(lib('ux', 'scripts', 'nudge.mjs'));
    return Boolean(switchedOn(ROOT));
  } catch {
    return false;
  }
}

/** How many reminders are due in the next month, read with the sweep's engine; 0 when none or unreadable. */
async function liveReminders(root = ROOT) {
  try {
    const data = JSON.parse(readFileSync(join(root, 'data', 'core', 'calendar', 'reminders.json'), 'utf8'));
    const { readReminders, nextTimes } = await import(lib('.claude', 'hooks', 'lib', 'reminder-schedule.mjs'));
    return readReminders(data).reminders.filter((r) => nextTimes(r, Date.now(), 1, 31).length).length;
  } catch {
    return 0;
  }
}

async function heartbeats() {
  if (!existsSync(at('.claude', 'jobs', 'README.md'))) {
    return [item('heartbeats', 'heartbeats', 'Heartbeat jobs', 'missing', 'no .claude/jobs registry in this copy', 'it comes with the harness; update the copy', 'person')];
  }
  const { readRegistry, heartbeatsOf, due, orchestrated, devOnly } = await import(lib('.claude', 'hooks', 'lib', 'heartbeats.mjs'));
  // A person's copy (an origin, no dev/) counts only the jobs the cloud may run: the
  // orchestrated rest are development jobs (cases.md, 2026-10-15). Her check-ins and
  // reminders run only from the hourly Claude routine (A-054, 2026-10-26).
  const hers = !existsSync(at('dev')) && Boolean(git(['remote', 'get-url', 'origin']));
  let reg;
  try {
    reg = readRegistry(ROOT);
  } catch {
    return [item('heartbeats', 'heartbeats', 'Heartbeat jobs', 'broken', 'the jobs registry could not be read', 'repair: .claude/jobs/README.md frontmatter, or .claude/jobs/state.json')];
  }
  // A job's run record shipped in its frontmatter until 2026-11-02, and a copy made
  // by cloning still carries the source's .claude/jobs/state.json, so a new copy holds the source's: only a finish commit in this copy's own history shows a run
  // here (rehearsal 2026-10-27: "1 of 1 have run" in a copy nothing had run in).
  const lastFinish = git(['log', '-1', '--format=%cI', '--grep=^chore(heartbeats): finish run']);
  const ranHere = Boolean(lastFinish);
  const own = (j) => (ranHere ? j : { ...j, status: 'never' });
  const jobs = heartbeatsOf(reg).filter((j) => !hers || orchestrated(j, 'cloud')).map(own);
  // A failure counts in every job the hourly Claude routine runs, not only those the cloud
  // may (2026-10-29: in her copy a failing cc-routine job read ✅); and a job capped after
  // its failures never runs again by itself, so it counts too, whatever its status says.
  const watched = heartbeatsOf(reg).filter((j) => (orchestrated(j, 'cloud') || orchestrated(j, 'cc-routine')) && !(hers && devOnly(j))).map(own);
  const capped = watched.filter((j) => due(j).state === 'capped').map((j) => j.name);
  const failed = watched.filter((j) => j.status === 'failed' && !capped.includes(j.name)).map((j) => j.name);
  const stale = watched.filter((j) => due(j).why === 'a claim went stale').map((j) => j.name);
  const never = jobs.filter((j) => (j.status ?? 'never') === 'never').map((j) => j.name);
  const out = [];
  const wanted = (await nudgeOn()) || (await liveReminders()) > 0;
  // Wanted, and nothing has ever run here: nothing reaches her phone, which `off` hid (round 2, A5).
  const unmet = hers && never.length === jobs.length && wanted;
  if (failed.length || stale.length || capped.length) {
    out.push(item('heartbeats', 'heartbeats', 'Heartbeat jobs', 'broken', [failed.length && `failed: ${failed.join(', ')}`, stale.length && `stuck: ${stale.join(', ')}`, capped.length && `stopped after repeated failures: ${capped.join(', ')}`].filter(Boolean).join('; '), `repair: read the last run of each; a stuck claim clears after 3 hours${capped.length ? '; a job stopped after repeated failures never runs again by itself: fix the cause, then start one run of it by hand' : ''}`));
  } else if (unmet) {
    out.push(item('heartbeats', 'heartbeats', 'Heartbeat jobs', 'missing', 'the nudge is on or a reminder is live, and no check-in has run here', 'telegram-routine.md, step 15.5: the hourly Claude routine', 'person'));
  } else if (never.length === jobs.length && hers) {
    out.push(item('heartbeats', 'heartbeats', 'Heartbeat jobs', 'off', 'no check-in has run: in her copy they run from the hourly Claude routine, set up only if she wants them', 'only if she wants check-ins or reminders: telegram.md, step 15', 'person'));
  } else if (never.length === jobs.length) {
    out.push(item('heartbeats', 'heartbeats', 'Heartbeat jobs', 'missing', 'no job has ever run', 'a scheduler: the Claude Routine (with the repository attached) or BAXTER', 'person'));
  } else {
    out.push(item('heartbeats', 'heartbeats', 'Heartbeat jobs', 'ok', `${jobs.length - never.length} of ${jobs.length} have run, none failing`));
  }
  // The routine is hourly: no finish run for a day, while the nudge is on or a reminder is
  // live, is a routine that stopped (2026-10-29: "1 of 1 have run" 20 days after the last).
  const quiet = lastFinish ? Date.now() - Date.parse(lastFinish) : 0;
  if (unmet) out.push(item('routine', 'heartbeats', 'Scheduled Routine', 'missing', 'the nudge is on or a reminder is live, and no routine has ever run here: nothing reaches her phone', 'telegram.md, step 15; until then, in her chat, a setup note', 'person'));
  else if (hers && never.length === jobs.length) out.push(item('routine', 'heartbeats', 'Scheduled Routine', 'off', 'nothing has run yet: her copy needs the routine only once she wants check-ins or reminders', 'telegram.md, step 15', 'person'));
  else if (quiet > ROUTINE_QUIET_MS && wanted) out.push(item('routine', 'heartbeats', 'Scheduled Routine', 'broken', `no finish run since ${lastFinish.slice(0, 10)}, and the check-in nudge is on or a reminder is live`, 'remote: claude.ai → the hourly routine: is it still there and on, with this repository attached? Then read its last run', 'remote'));
  else out.push(item('routine', 'heartbeats', 'Scheduled Routine', 'unknown', 'Routines live on claude.ai', 'remote: list the Routines; the one running .claude/jobs/README.md must have this repository attached, or it runs with nothing', 'remote'));
  return out;
}

// What only GitHub can show about a copy, read from its run logs with --fetch: the
// secrets and the Actions minutes. Read-only, through `gh`. A log is never
// printed or kept: each is searched for the workflows' own status lines and only
// those are judged, because a run once printed record text into its log (2026-10-08).

/**
 * The status lines the workflows echo; nothing else is read from a log. Only output
 * counts: it follows the timestamp directly, while the script GitHub prints into
 * every log carries the same words after `echo` (2026-10-10: every log read as
 * both inert and pinged until this was anchored).
 */
const LINES = /\dZ (heartbeats: inert|check-in: inert|nudge: sent from GitHub)/;

const titem = (id, label, state, evidence, next = '', who = 'agent') => item(id, 'telegram', label, state, evidence, next, who);

/** The status lines in one log, deduplicated. */
export const statusLines = (log) => [...new Set((log ?? '').split('\n').map((l) => l.match(LINES)?.[1]).filter(Boolean))];

/**
 * Where a reminder's delivery shows (HBT-010 design 2): the hourly sweep, a Claude
 * routine, sends each one and keeps a tally of what Telegram accepted, so the proof is
 * the routine itself and that tally, never a log outside the repository.
 */
export const ROUTINE_PROOF = 'remote: claude.ai → the hourly routine runs with this repository attached, its environment holding TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID with api.telegram.org allowed; `node ux/scripts/reminders.mjs list --shape` shows what Telegram accepted, and any missed, without a word of any reminder';

/**
 * Her reminders file (HBT-010): read with the sweep's own engine, so a problem here is
 * a reminder that will not go out. Only the sweep sends it, and only with "send": "routine".
 */
export async function judgeReminders(root = ROOT) {
  const file = join(root, 'data', 'core', 'calendar', 'reminders.json');
  if (!existsSync(file)) return titem('reminders', 'Reminders', 'off', 'no reminder has been set yet');
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return titem('reminders', 'Reminders', 'broken', 'the reminders file is not valid JSON, so the sweep reads none of it', 'repair: node ux/scripts/reminders.mjs check', 'agent');
  }
  const { readReminders, nextTimes } = await import(lib('.claude', 'hooks', 'lib', 'reminder-schedule.mjs'));
  const { errors, reminders } = readReminders(data);
  if (errors.length) return titem('reminders', 'Reminders', 'broken', `${errors.length} entr${errors.length === 1 ? 'y' : 'ies'} the sweep cannot read`, 'repair: node ux/scripts/reminders.mjs check names each', 'agent');
  // The blank record's empty file (no "send", timezone UTC) is a copy where she has
  // asked for none, not a broken one (rehearsal 2026-10-27: ❌ on every new copy).
  if (!reminders.length) return titem('reminders', 'Reminders', 'off', 'no reminder has been set yet');
  if (data.send !== 'routine') return titem('reminders', 'Reminders', 'broken', 'the file does not read "send": "routine", and nothing else sends it', 'repair: set "send": "routine" in the reminders file, then node ux/scripts/reminders.mjs check', 'agent');
  if (!data.timezone || data.timezone === 'UTC') return titem('reminders', 'Reminders', 'broken', 'the file has no timezone of hers, so every time is read as UTC', 'repair: set "timezone" from data/PROFILE.yaml', 'agent');
  const { herTimezone } = await import(lib('ux', 'scripts', 'reminders.mjs'));
  const timeZone = herTimezone(root);
  if (timeZone && data.timezone !== timeZone) return titem('reminders', 'Reminders', 'broken', `the file says ${data.timezone}, her profile ${timeZone}`, 'repair: set "timezone" from data/PROFILE.yaml', 'agent');
  const live = reminders.filter((r) => nextTimes(r, Date.now(), 1, 31).length).length;
  return titem('reminders', 'Reminders', live ? 'unknown' : 'ok', `${reminders.length} entr${reminders.length === 1 ? 'y reads' : 'ies read'} clean in ${data.timezone}, ${live} due in the next month`, live ? ROUTINE_PROOF : '', live ? 'remote' : 'agent');
}

/**
 * What a past run still proves (set-up remote-evidence.md): only a log that can be read, from a
 * run newer than the last change to the secrets. `log` is null when it cannot be
 * read (logs go after 90 days); `changed` is the latest secret update, or null
 * when that cannot be read. `lines` is null when the run proves nothing.
 */
export function proof(run, log, changed) {
  if (!run) return { lines: [], why: '' };
  const day = String(run.createdAt).slice(0, 10);
  if (log === null) return { lines: null, why: `the log of the run on ${day} cannot be read (logs are kept 90 days)` };
  if (!changed) return { lines: null, why: 'when the secrets last changed cannot be read, so no past run proves them' };
  if (Date.parse(run.createdAt) <= Date.parse(changed)) return { lines: null, why: `the run on ${day} is older than the last change to the secrets (${changed.slice(0, 10)})` };
  return { lines: statusLines(log), why: '' };
}

/** The secrets, from their effect: the latest heartbeat run's lines and any test message that arrived. */
export function judgeSecrets(runLines, testSent, why = '') {
  if ((runLines ?? []).includes('heartbeats: inert')) return titem('secrets', 'Claude and Telegram secrets', 'broken', 'the last heartbeat run says no CLAUDE_CODE_OAUTH_TOKEN', 'telegram.md step 15.3, in the web form', 'person');
  if (testSent) return titem('secrets', 'Claude and Telegram secrets', 'ok', 'a test message logged "nudge: sent from GitHub", and the Claude token is set');
  if (why) return titem('secrets', 'Claude and Telegram secrets', 'unknown', why, 'remote: open the run in Actions; or, with the phone owner\'s yes that day, a new test_nudge (telegram.md step 15.4)', 'remote');
  return titem('secrets', 'Claude and Telegram secrets', 'unknown', 'the Claude token is set; no test message has been sent yet', 'telegram.md step 15.4, with the phone owner\'s yes that day', 'person');
}

/**
 * GitHub Actions minutes against the free allowance (DEP-014 design 4). Every
 * run bills at least a minute, so a day's runs times thirty is a floor for the
 * month; past the share, it reads broken before the allowance runs out.
 */
export function judgeLimits(runsToday) {
  const allowance = threshold('setUp.actionsMinutes', 'minutes');
  const share = threshold('setUp.limitShare', 'percent');
  if (!allowance || !share) return titem('limits', 'Free-tier limits', 'unknown', 'the allowance thresholds could not be read', 'node ux/scripts/thresholds.mjs', 'agent');
  const month = runsToday * 30;
  const used = Math.round((month / allowance) * 100);
  const said = `${runsToday} Actions runs in the last day: at least ${month} of ${allowance} free minutes a month (${used}%)`;
  return used >= share
    ? titem('limits', 'Free-tier limits', 'broken', said, 'find the workflow starting the most runs in the Actions tab, and slow its schedule or narrow it to her hours', 'person')
    : titem('limits', 'Free-tier limits', 'ok', said);
}

const gh = (args, cwd) => {
  try {
    return execFileSync('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
};
const runs = (workflow, cwd, limit) => JSON.parse(gh(['run', 'list', '--workflow', workflow, '--limit', String(limit), '--json', 'databaseId,event,createdAt,conclusion'], cwd) ?? '[]');
const log = (id, cwd) => gh(['run', 'view', String(id), '--log'], cwd);

const QUIET_RUNS = ['cancelled', 'skipped'];
const FAILED_RUNS = ['failure', 'timed_out', 'startup_failure', 'action_required'];

/**
 * The newest finished heartbeat run, when it failed after the secrets last changed: the
 * pipe is broken now, whatever an older run proved (2026-10-29: two failed runs, still
 * "secrets ok"). `beats` newest first, as `gh run list` gives them. Null when it says nothing.
 */
export function judgeLastBeat(beats, changed) {
  // A cancelled or skipped run says nothing about the pipe, so the one before it is read;
  // one that timed out, failed to start or waits on an approval is as broken as a
  // failure (round 2, C19: each once read "secrets ok").
  const last = (beats ?? []).find((r) => r.conclusion && !QUIET_RUNS.includes(r.conclusion));
  if (!last || !FAILED_RUNS.includes(last.conclusion)) return null;
  if (changed && Date.parse(last.createdAt) <= Date.parse(changed)) return null;
  return titem('secrets', 'Claude and Telegram secrets', 'broken', `the last heartbeat run, on ${String(last.createdAt).slice(0, 10)}, ${last.conclusion === 'failure' ? 'failed' : `ended ${last.conclusion.replace('_', ' ')}`}`, 'remote: open that run in the Actions tab and read its log (remote-evidence.md)', 'remote');
}

/** Who can read the record: a public repository, or anyone beyond its owner (set-up edge cases, 2026-10-29). Counts only, never a name. */
export function judgeAccess(visibility, collaborators) {
  const out = [];
  if (visibility === null) out.push(item('visibility', 'repo', 'Repository is private', 'unknown', 'its visibility could not be read', 'remote: the repository\'s Settings → General → Danger Zone shows it', 'remote'));
  else if (String(visibility).toUpperCase() !== 'PRIVATE') out.push(item('visibility', 'repo', 'Repository is private', 'broken', `the repository is ${String(visibility).toLowerCase()}: anyone can read the record`, 'make it private now: Settings → General → Danger Zone → Change visibility (only the owner can)', 'person'));
  else out.push(item('visibility', 'repo', 'Repository is private', 'ok', 'private'));
  if (collaborators === null) out.push(item('collaborators', 'repo', 'Only the owner has access', 'unknown', 'who has access could not be read', 'remote: the repository\'s Settings → Collaborators', 'remote'));
  else if (collaborators > 1) out.push(item('collaborators', 'repo', 'Only the owner has access', 'broken', `${collaborators - 1} account(s) besides the owner can open the repository, and its whole history`, 'the owner looks at Settings → Collaborators and removes anyone she did not mean to give her record to', 'person'));
  else out.push(item('collaborators', 'repo', 'Only the owner has access', 'ok', 'the owner only'));
  return out;
}

/**
 * How big the repository has grown on GitHub (round 3, D13), from the repos API's
 * `size`, in KB. GitHub asks that repositories stay small; the line drawn here, 1 GB,
 * is UNVERIFIED against GitHub's current guidance, and waits to become a threshold
 * row (FND-009) with its source and date. Null size: nothing is said.
 */
const REPO_SIZE_WARN_KB = 1024 * 1024;
export function judgeSize(kb) {
  if (kb === null || kb === undefined || !Number.isFinite(Number(kb))) return null;
  const mb = Math.round(Number(kb) / 1024);
  return Number(kb) >= REPO_SIZE_WARN_KB
    ? item('size', 'repo', 'Repository size', 'broken', `the repository is ${mb} MB on GitHub, past 1 GB (a line not yet checked against GitHub's own)`, 'find what grew it (a large file in data/ is the usual cause), with the developer; nothing is deleted from the record', 'person')
    : item('size', 'repo', 'Repository size', 'ok', `${mb} MB on GitHub`);
}

/** The findings, or null when `gh` cannot read this repository (the doctor then keeps them unknown). */
export function remoteFindings(cwd) {
  if (gh(['auth', 'status'], cwd) === null) return null;
  const beats = runs('heartbeats.yml', cwd, 60);
  if (!beats.length && gh(['repo', 'view', '--json', 'name'], cwd) === null) return null;
  // The last change to any secret; none set at all means nothing has changed since.
  const listed = gh(['secret', 'list', '--json', 'name,updatedAt'], cwd);
  const changed = listed === null ? null : (JSON.parse(listed).map((x) => x.updatedAt).sort().at(-1) ?? '1970-01-01T00:00:00Z');
  const last = beats.find((r) => r.conclusion === 'success');
  const c = proof(last, last ? log(last.databaseId, cwd) : '', changed);
  const tests = runs('check-in.yml', cwd, 30).filter((r) => r.event === 'workflow_dispatch').slice(0, 5).map((r) => proof(r, log(r.databaseId, cwd), changed));
  const testSent = tests.some((t) => t.lines?.includes('nudge: sent from GitHub'));
  const since = new Date(Date.now() - 86400000).toISOString().slice(0, 19);
  const today = JSON.parse(gh(['run', 'list', '--created', `>=${since}`, '--limit', '1000', '--json', 'databaseId'], cwd) ?? '[]').length;
  const why = tests.find((t) => t.why)?.why || c.why;
  const visibility = (() => { try { return JSON.parse(gh(['repo', 'view', '--json', 'visibility'], cwd) ?? 'null')?.visibility ?? null; } catch { return null; } })();
  const people = gh(['api', '--paginate', 'repos/{owner}/{repo}/collaborators', '--jq', '.[].id'], cwd);
  const collaborators = people === null ? null : people.split('\n').filter((l) => l.trim()).length;
  const size = (() => { const kb = gh(['api', 'repos/{owner}/{repo}', '--jq', '.size'], cwd); return kb === null || !kb.trim() ? null : Number(kb.trim()); })();
  return [judgeLastBeat(beats, changed) ?? judgeSecrets(c.lines, testSent, why), judgeLimits(today), ...judgeAccess(visibility, collaborators), judgeSize(size)].filter(Boolean);
}

async function telegram(fetched) {
  const out = [];
  const sw = read('data', 'core', 'me', 'nudge.md');
  if (sw === null) {
    out.push(item('switch', 'telegram', 'Check-in nudge switched on', 'off', 'no nudge.md: she has not asked for it', 'only she turns it on, in her own conversation (CON-009)', 'person'));
  } else {
    const { switchedOn } = await import(lib('ux', 'scripts', 'nudge.mjs'));
    const on = switchedOn(ROOT);
    out.push(item('switch', 'telegram', 'Check-in nudge switched on', on ? 'ok' : 'off', on ? 'on' : 'off, her choice', on ? '' : 'only she turns it on, in her own conversation (CON-009)', on ? 'agent' : 'person'));
    {
      const { lastSessionHard, holdOff } = await import(lib('ux', 'scripts', 'nudge.mjs'));
      if (holdOff(ROOT)) out.push(item('hold', 'telegram', 'Pause', 'off', 'the hard-session pause is off, her choice (`hold: off`, HBT-005 design 2)', 'only she turns it back on', 'person'));
      let hard = false;
      try {
        hard = lastSessionHard(ROOT);
      } catch {
        hard = false;
      }
      // The hold covers the session's day and the next (HBT-005 design 2), so a
      // session dated today holds through tomorrow; "resumes tomorrow" was said
      // wrongly on 2026-10-10.
      let still = false;
      try {
        still = hard && lastSessionHard(ROOT, new Date(Date.now() + 86400e3));
      } catch {
        still = false;
      }
      if (hard && !holdOff(ROOT)) out.push(item('hold', 'telegram', 'Pause', 'paused', `the check-in nudge is paused ${still ? 'today and all of tomorrow, resuming the day after' : 'for the rest of today, resuming tomorrow'} by themselves (HBT-005)`, 'nothing: never lift it, and never send a test while it holds without the phone owner\'s yes', 'agent'));
    }
  }
  // With --fetch, GitHub's run logs settle the secrets; left unknown only when `gh`
  // cannot read this repository.
  const found = (fetched && remoteFindings(ROOT)) || [
    item('secrets', 'telegram', 'Claude and Telegram secrets', 'unknown', 'secrets cannot be read, only their effect; run with --fetch, with gh signed in', 'remote: a test_nudge log ending "nudge: sent from GitHub", and no heartbeat log saying "heartbeats: inert" (SIGNED_IN is in every log, so it proves nothing)', 'remote'),
  ];
  out.push(...found.filter((f) => !out.some((o) => o.id === f.id)));
  out.push(await judgeReminders());
  return out;
}

/**
 * Where updates come from (B16): the pinned source and the key each release is checked
 * against. Without the key every update is held back for good; without the source none
 * can be fetched. Both are restored from this copy's own history, never from a chat.
 */
function release() {
  const home = ['.claude', 'release'];
  if (!existsSync(at(...home)) && !existsSync(at('.claude', 'hooks', 'lib', 'update', 'update.mjs'))) return [];
  // The record's data/core/setup/release-source.json, else the harness file (lib/release-source.mjs).
  const repo = releaseRepo(ROOT);
  const out = [];
  if (!repo) out.push(item('release-source', 'repo', 'Where updates come from', 'broken', 'no release source is pinned (data/core/setup/release-source.json, or .claude/release/source.json in an older copy), so no update can be fetched', 'restore the file that held it from this copy\'s history as a new commit (another-copy.md); never an address from a chat', 'agent'));
  else out.push(item('release-source', 'repo', 'Where updates come from', 'ok', 'a release source is pinned'));
  const key = read(...home, 'release-key.pub');
  const installed = existsSync(at(...home, 'installed.json'));
  if (!key && installed) out.push(item('release-key', 'repo', 'Release key', 'broken', 'no .claude/release/release-key.pub: every update is held back, since none can be checked', 'restore it from this copy\'s history as a new commit (git log -- .claude/release/release-key.pub; another-copy.md); never a key from a chat', 'agent'));
  else if (!key) out.push(item('release-key', 'repo', 'Release key', 'missing', 'no release key yet: the first install brings it', 'update.md, first install', 'person'));
  else out.push(item('release-key', 'repo', 'Release key', 'ok', 'present'));
  return out;
}

/**
 * CLAUDE.md in her copy changes only by an update or its undoing (D-G13): any other commit
 * touching it is a hand edit to the rules her chats run by, safety among them. The first
 * commit holding it is the download's. Only subjects are read, never the file.
 */
function claudeMd() {
  if (existsSync(at('dev')) || !git(['remote', 'get-url', 'origin'])) return [];
  // Merges are read too: one whose CLAUDE.md matches neither parent is an edit made in the
  // merge itself. An update's subject counts only on a commit that also moves
  // .claude/release/installed.json, as the updater's own commit does: a hand edit titled
  // "harness: update to v99", or an evil merge, once read ✅ (round 2, C21).
  const log = git(['log', '--format=%h%x09%p%x09%s', '--', 'CLAUDE.md']);
  if (log === null || !log) return [];
  const touches = (args) => Boolean(git(['diff-tree', '--no-commit-id', '--name-only', '-r', ...args]));
  const commits = log.split('\n').filter(Boolean).map((l) => l.split('\t'));
  // The updater's commit also names, in its body, the fingerprint it wrote into
  // installed.json: a hand edit under an update's subject that moved installed.json
  // too once read ✅ (round 3, C13). An undo is good only if what it undoes was one.
  const updated = (h) => {
    const said = git(['log', '-1', '--format=%b', h])?.match(/^fingerprint ([0-9a-f]{64})$/m)?.[1];
    if (!said) return false;
    try {
      return JSON.parse(git(['show', `${h}:.claude/release/installed.json`]) ?? 'null')?.fingerprint === said;
    } catch {
      return false;
    }
  };
  const released = (h, subject) => {
    if (!touches([h, '--', '.claude/release/installed.json'])) return false;
    if (/^harness: update to v/.test(subject)) return updated(h);
    if (/^Revert "harness: update to v/.test(subject)) {
      const undone = git(['log', '-1', '--format=%b', h])?.match(/This reverts commit ([0-9a-f]{7,40})/)?.[1];
      return Boolean(undone) && updated(undone);
    }
    return false;
  };
  const edits = commits.slice(0, -1).filter(([h, parents, subject]) => {
    if (parents.split(' ').length > 1) return touches(['--cc', h, '--', 'CLAUDE.md']);
    return !released(h, subject);
  }).map(([h]) => h);
  return edits.length
    ? [item('claude-md', 'repo', 'CLAUDE.md as released', 'broken', `${edits.length} commit(s) changed CLAUDE.md other than an update: ${edits.join(', ')}`, 'read each diff; a change not from a release goes back with git revert, and the developer is told', 'person')]
    : [item('claude-md', 'repo', 'CLAUDE.md as released', 'ok', 'changed only by the download and updates')];
}

const AREAS = ['repo', 'saves', 'record', 'heartbeats', 'telegram'];

export async function diagnose({ fetched = false } = {}) {
  const items = [history(), remote(), hooks(), ...copyFor(), ...release(), ...claudeMd(), ...saves(fetched), ...workflows(), ...(await record()), ...(await heartbeats()), ...(await telegram(fetched))];
  const failed = items.some((i) => i.id === 'safety-plan' && i.evidence === FAILED) ? FAILED : null;
  return { environment: environment(process.env, fetched), failed, items: items.sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area)) };
}

const MARK = { ok: '✅', broken: '❌', missing: '⬜', unknown: '❔', paused: '⏸️', off: '➖' };

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const fetched = process.argv.includes('--fetch') && git(['fetch', '-q', 'origin']) !== null;
  const report = await diagnose({ fetched });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const e = report.environment;
    if (report.failed) console.log(`FAILED: ${report.failed}. The setup cannot finish.\n`);
    console.log(`setup-doctor: ${e.where}, ${e.platform}, ${e.copy === 'new' ? 'a new copy, not yet on GitHub' : `the ${e.copy}'s copy`}, node ${e.node}; tools: ${Object.entries(e.tools).map(([t, ok]) => `${t} ${ok ? 'yes' : 'no'}`).join(', ')}`);
    let area = '';
    for (const i of report.items) {
      if (i.area !== area) console.log(`\n${(area = i.area)}`);
      console.log(`  ${MARK[i.state]} ${i.label}: ${i.evidence}${i.next ? `\n      → ${i.next}` : ''}`);
    }
    const count = (s) => report.items.filter((i) => i.state === s).length;
    console.log(`\n${count('ok')} ok · ${count('broken')} broken · ${count('missing')} missing · ${count('unknown')} to look at · ${count('paused')} paused · ${count('off')} off`);
  }
}
