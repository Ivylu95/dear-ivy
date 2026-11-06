// What is due a recheck: every grounded procedure past its "Next due", or
// brought forward because something it depends on changed, and every spec
// register past its review, and the crisis-lines catalogue past its re-check
// (SAF-017).
//
//   node .claude/hooks/lib/currency.mjs          what is due, one line each
//   node .claude/hooks/lib/currency.mjs --all    everything, with its date and why
//
// PMM-006, "Procedures are re-checked on schedule, and sooner when anything
// shifts." Each log keeps its own date (FND-005, "Every fact has one
// authoritative home; everything else points to it."); this only gathers them,
// so a skill nobody runs is no longer the one that goes stale unseen. Registers
// are due a fixed interval (PMM-006's threshold) after their last row in the
// Reviews table of dev/skills/spec-shared/coverage.md, or now if they have none
// (spec-review's closing.md § When a review is due). Read by the session-start notice and
// the dev-hygiene heartbeat; it changes nothing, and stops nothing: a due
// procedure keeps running as written (PMM-006 clause 3).
//
// Brought forward (PMM-006 clause 2, design 4). A log's re-check is due today,
// whatever its Next due says, when any of these is newer than its Last run:
//
//   model    the log's Status row `| **Model** | claude-… |` names the model it
//            was last checked under, and the session runs another. The current
//            model is the SessionStart payload's `model`, else ANTHROPIC_MODEL,
//            else `model` in .claude/settings.local.json or settings.json. An
//            alias ("opus") or nothing at all cannot be compared: the trigger
//            is skipped, and --all says so. A log with no Model row is unknown,
//            never due on this count.
//   source   the practice cache every skill is measured by (PMM-017,
//            .claude/skills/practice.md) was grounded or changed after the
//            skill's Last run: its "Last grounded" date or the newest dated line
//            under its Changes. Skills only, not other logs. No network: a web
//            source a log cites moving is not seen here.
//   failure  a failure in use recorded after the Last run: the log's Status row
//            `| **Failed in use** | YYYY-MM-DD · what failed |`; an open case
//            (`### YYYY-MM-DD · …` under `## Open`) in the skill's cases.md; a
//            recorded run in dev/skills/<name>/evals-results.json (PMM-010,
//            PMM-011) dated after it that missed a query, failed a scenario or
//            broke a must-never; or that file gone stale, its tests committed
//            after the Last run and changed since the run.
//
// Recording the re-check, even one that changed nothing, is what clears every
// trigger: Last run set to the day of it (and Model to the model it ran under).
// The convention is the skill-writer skill's Stamp step and its log template,
// modules/core/templates/skill-writer/log.md.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKILLS_DIR } from './paths.mjs';
import { threshold } from './thresholds.mjs';

// PMM-006 states it (FND-009). Unreadable, no register is shown as due.
const REVIEW_MONTHS = threshold('specReview.interval', 'months');
const SEARCHED = ['.claude/skills', 'modules', SKILLS_DIR];

const walk = (dir) => {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((n) => {
    if (n === 'node_modules' || n === 'templates' || n.startsWith('_')) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n === 'log.md' ? [p] : [];
  });
};

const addMonths = (iso, m) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
};

// The practice cache every skill is measured by. The same path as CACHE in
// ux/scripts/check-procedures.mjs; test-currency.mjs pins the two equal.
export const PRACTICE = '.claude/skills/practice.md';
const DATE = /\d{4}-\d{2}-\d{2}/;
const newest = (dates) => dates.filter(Boolean).sort().pop() ?? null;
/** A Status row's value, `| **Label** | value |`, or null. */
const statusCell = (text, label) => text.match(new RegExp(`^\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*([^|\\n]*)`, 'm'))?.[1].trim() ?? null;

/** A model id reduced to what changes behaviour: no context suffix, no date stamp. Null for an alias or nothing. */
export function normalModel(id) {
  const m = String((id && typeof id === 'object' ? id.id : id) ?? '')
    .trim()
    .toLowerCase()
    .replace(/\[[^\]]*\]$/, '')
    .replace(/-\d{8}$/, '');
  return /^claude-[a-z0-9.-]+$/.test(m) ? m : null;
}

/** The model this session runs: { id, from } or { id: null, from: why it is unknown }. */
export function currentModel(root, given) {
  const tries = [
    ['the session', given],
    ['ANTHROPIC_MODEL', process.env.ANTHROPIC_MODEL],
    ...['settings.local.json', 'settings.json'].map((f) => {
      try {
        return [`.claude/${f}`, JSON.parse(readFileSync(join(root, '.claude', f), 'utf8')).model];
      } catch {
        return [`.claude/${f}`, undefined];
      }
    }),
  ];
  const set = tries.find(([, v]) => v);
  if (!set) return { id: null, from: 'no model named by the session, ANTHROPIC_MODEL or settings' };
  const id = normalModel(set[1]);
  return id ? { id, from: set[0] } : { id: null, from: `${set[0]} names "${typeof set[1] === 'object' ? set[1].id : set[1]}", an alias that cannot be compared` };
}

/** When the practice cache last moved: its Last grounded date or its newest Changes line. Null without one. */
export function practiceMoved(root) {
  let text;
  try {
    text = readFileSync(join(root, PRACTICE), 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
  const grounded = text.match(/\*\*Last grounded:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  const changes = (text.split(/^## Changes$/m)[1] ?? '').split(/^## /m)[0];
  return newest([grounded, ...[...changes.matchAll(/^- (\d{4}-\d{2}-\d{2})/gm)].map((m) => m[1])]);
}

/** Every skill's folder name, wherever it lives. */
function skillNames(root) {
  const has = (dir) => {
    try {
      return readdirSync(join(root, dir)).filter((n) => existsSync(join(root, dir, n, 'SKILL.md')));
    } catch {
      return [];
    }
  };
  let mods = [];
  try {
    mods = readdirSync(join(root, 'modules'));
  } catch {
    // a copy without modules has none
  }
  return new Set([...has('.claude/skills'), ...has(SKILLS_DIR), ...mods.flatMap((m) => has(`modules/${m}/skills`))]);
}

// The hash a result is tied to. The same as testHashes in ux/lib/skill-evals.mjs
// (hooks do not import ux/ at run time); test-currency.mjs pins the two equal.
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
export const evalsHashes = (t) => ({ firing: hash([t.shouldFire, t.shouldNotFire]), scenarios: hash(t.scenarios) });

/** The day a file was last committed, today if it has uncommitted changes, null outside git. */
function committed(root, rel, today) {
  try {
    if (execFileSync('git', ['status', '--porcelain', '--', rel], { cwd: root, encoding: 'utf8' }).trim()) return today;
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', rel], { cwd: root, encoding: 'utf8' }).trim() || today;
  } catch {
    return null;
  }
}

/** Failures in use the evals record for one skill: [{ date, detail }]. Nothing without a results file. */
export function evalsFailures(root, name, today) {
  const dir = join(root, SKILLS_DIR, name);
  let t, r;
  try {
    r = JSON.parse(readFileSync(join(dir, 'evals-results.json'), 'utf8'));
    t = JSON.parse(readFileSync(join(dir, 'evals.json'), 'utf8'));
  } catch {
    return []; // never run, or unreadable: the unproven list and check-skills own that
  }
  const out = [];
  const h = evalsHashes(t);
  const f = r.firing;
  if (f && f.hash === h.firing && f.right < f.total) out.push({ date: f.date, detail: `firing missed ${f.total - f.right} of ${f.total} (${f.date})` });
  const sc = r.scenarios;
  if (sc && sc.hash === h.scenarios) {
    const ran = sc.results ?? [];
    const failed = ran.filter((x) => !x.with?.pass || x.with?.mustNeverBroken?.length).map((x) => x.id);
    if (failed.length) out.push({ date: sc.date, detail: `scenarios failed ${failed.join(', ')} (${sc.date})` });
  }
  if ((f && f.hash !== h.firing) || (sc && sc.hash !== h.scenarios)) {
    const date = committed(root, relative(root, join(dir, 'evals.json')).replace(/\\/g, '/'), today);
    if (date) out.push({ date, detail: `evals result stale: tests changed ${date}, after the last recorded run` });
  }
  return out;
}

/** Open cases in a cases.md, as [{ date, detail }]. */
function openCases(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return [];
  }
  const open = (text.split(/^## Open$/m)[1] ?? '').split(/^## /m)[0];
  return [...open.matchAll(/^### (\d{4}-\d{2}-\d{2}) · (.*)$/gm)].map((m) => ({ date: m[1], detail: `open case ${m[1]}: ${m[2].split(' · ').pop()}` }));
}

/**
 * Every grounded log: { kind: 'log', what, due, last, model, failed }. A log
 * with no readable date is due now. `last` is its Last run, `model` the model
 * it was checked under (null: not recorded), `failed` its Failed in use row.
 */
export function logs(root) {
  return SEARCHED.flatMap((d) => walk(join(root, d))).map((file) => {
    const what = relative(root, file).replace(/\\/g, '/');
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const failed = statusCell(text, 'Failed in use');
    return {
      kind: 'log',
      what,
      due: statusCell(text, 'Next due')?.match(DATE)?.[0] ?? null,
      last: statusCell(text, 'Last run')?.match(DATE)?.[0] ?? null,
      model: normalModel(statusCell(text, 'Model')?.match(/claude-[\w.-]+(\[[^\]]*\])?/i)?.[0]),
      failed: failed?.match(DATE) ? { date: failed.match(DATE)[0], detail: `failed in use ${failed}` } : null,
    };
  });
}

/**
 * Why a log's re-check is brought forward: [{ why: 'model'|'source'|'failure', detail }].
 * `ctx` is { model, practice, skills, today } from currency().
 */
export function forward(root, e, ctx) {
  const out = [];
  const after = (date) => date && (!e.last || date > e.last);
  if (ctx.model?.id && e.model && e.model !== ctx.model.id) out.push({ why: 'model', detail: `checked under ${e.model}, now ${ctx.model.id}` });
  const name = basename(dirname(join(root, e.what)));
  const skill = ctx.skills.has(name);
  if (skill && after(ctx.practice)) out.push({ why: 'source', detail: `practice cache moved ${ctx.practice}, after the last run` });
  const failures = [
    e.failed,
    ...openCases(join(root, dirname(e.what), 'cases.md')),
    ...(dirname(e.what) !== `${SKILLS_DIR}/${name}` ? openCases(join(root, SKILLS_DIR, name, 'cases.md')) : []),
    ...(skill ? evalsFailures(root, name, ctx.today) : []),
  ].filter((f) => f && after(f.date));
  for (const f of failures) out.push({ why: 'failure', detail: f.detail });
  return out;
}

/** Every register: { kind: 'register', what, due, last }. Never reviewed is due now. */
export function registers(root) {
  const lint = join(root, 'ux', 'scripts', 'spec-lint.mjs');
  const coverage = join(root, SKILLS_DIR, 'spec-shared', 'coverage.md');
  if (!existsSync(lint) || !existsSync(coverage)) return []; // a copy without dev/specs/ has no registers to review
  const paths = execFileSync('node', [lint, '--counts'], { cwd: join(root, 'ux'), encoding: 'utf8' })
    .split('\n')
    .map((l) => l.split('\t')[1])
    .filter(Boolean);
  const reviews = readFileSync(coverage, 'utf8').split(/^## Reviews$/m)[1]?.split(/^## /m)[0] ?? '';
  const last = {};
  for (const [, date, path] of reviews.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*`([^`]+)`/gm)) {
    if (!last[path] || date > last[path]) last[path] = date;
  }
  return paths.map((what) => ({ kind: 'register', what, last: last[what] ?? null, due: last[what] && REVIEW_MONTHS ? addMonths(last[what], REVIEW_MONTHS) : null }));
}

// SAF-017, "Crisis numbers are re-checked on a clock and a move": the catalogue
// every copy's numbers are set from. Due at its **Next due** date, and sooner
// for any line whose Checked date is older than its **Interval**, or that has no
// source or no date: shown to the developer only, while every number keeps
// showing to her as written. Its design 1 was enforced by instruction alone.
export const CRISIS_LINES = 'modules/core/knowledge/crisis-lines.md';

/** The catalogue: [{ kind: 'crisis-lines', what, due, problems }], or [] where there is none. */
export function crisisLines(root, today = new Date().toISOString().slice(0, 10)) {
  let text;
  try {
    text = readFileSync(join(root, CRISIS_LINES), 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return [];
  }
  const due = text.match(/\*\*Next due:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const months = Number(text.match(/\*\*Interval:\*\*\s*(\d+)\s*months?/)?.[1] ?? 3);
  const problems = [];
  let country = null;
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      country = /^(Roles|No entry|Changes)\b/i.test(heading[1]) ? null : heading[1];
      continue;
    }
    if (!country || !/^\|/.test(line) || /^\|\s*(Role|---)/.test(line)) continue;
    const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const [role, , , , source, , checked] = cells;
    if (!role) continue;
    if (!source) problems.push(`${country} ${role}: no source`);
    if (!DATE.test(checked ?? '')) problems.push(`${country} ${role}: no checked date`);
    else if (addMonths(checked.match(DATE)[0], months) <= today) problems.push(`${country} ${role}: checked ${checked.match(DATE)[0]}`);
  }
  return [{ kind: 'crisis-lines', what: CRISIS_LINES, due, problems }];
}

/**
 * MNT-008 design 3, "with the oldest overdue register offered on the development
 * menu": a count of what is due was shown every session and none was reviewed,
 * so the menu names one. Never reviewed comes first, in the index's order;
 * then the earliest last review. Null when none is due.
 */
export function oldestDue(entries) {
  const due = entries.filter((e) => e.kind === 'register' && e.overdue);
  if (!due.length) return null;
  return due.reduce((a, b) => (!a.last ? a : !b.last || b.last < a.last ? b : a));
}

/**
 * Everything, each marked overdue when its date has passed, it has none, or
 * (a log) something it depends on changed since its last run. `opts.model` is
 * the session's model id, when the caller has it.
 */
export function currency(root, today = new Date().toISOString().slice(0, 10), opts = {}) {
  const ctx = { model: currentModel(root, opts.model), practice: practiceMoved(root), skills: skillNames(root), today };
  const logged = logs(root).map((e) => {
    const brought = forward(root, e, ctx);
    const dated = !e.due || e.due <= today;
    return { ...e, forward: brought, overdue: dated || brought.length > 0 };
  });
  return [
    ...logged,
    ...registers(root).map((e) => ({ ...e, overdue: !e.due || e.due <= today })),
    ...crisisLines(root, today).map((e) => ({ ...e, overdue: !e.due || e.due <= today || e.problems.length > 0 })),
  ];
}

/** Skills with no log at all: nothing records what they were grounded on (PMM-005). */
export function unlogged(root) {
  return ['.claude/skills', SKILLS_DIR].flatMap((d) => {
    let names;
    try {
      names = readdirSync(join(root, d));
    } catch {
      return [];
    }
    return names.filter((n) => {
      const skill = join(root, d, n, 'SKILL.md');
      // A shipped skill may keep its log in its development half (set-up, DEP-014).
      if (!existsSync(skill) || existsSync(join(root, d, n, 'log.md')) || existsSync(join(root, SKILLS_DIR, n, 'log.md'))) return false;
      // A `dev-` entry points to its body in dev/skills/, whose log is beside it (ARC-005, T-479).
      if (d === '.claude/skills' && n.startsWith('dev-') && existsSync(join(root, SKILLS_DIR, n.slice(4), 'log.md'))) return false;
      return !/body lives in the proprietary core|A pointer\./.test(readFileSync(skill, 'utf8')); // a stub's log is beside its body
    }).map((n) => `${d}/${n}`);
  });
}

/** A due log's name in the notice, with why: its date, or what brought it forward. */
const named = (e, today) => {
  const why = [...new Set(e.forward.map((f) => f.why))];
  if (!e.due || e.due <= today) why.unshift(e.due ? `due ${e.due}` : 'no date');
  return `${e.what.replace(/\/log\.md$/, '').split('/').pop()} (${why.join(', ')})`;
};

/** The developer's notice: at most four lines, nothing when nothing is due. */
export function summary(root, today = new Date().toISOString().slice(0, 10), opts = {}) {
  const all = currency(root, today, opts);
  const lines = [];
  const logsDue = all.filter((e) => e.kind === 'log' && e.overdue);
  if (logsDue.length) lines.push(`  re-ground due (PMM-006): ${logsDue.map((e) => named(e, today)).join(', ')}. Each keeps running as written; --all says why. Run: the skill-writer skill, re-ground mode`);
  const regs = all.filter((e) => e.kind === 'register');
  const regsDue = regs.filter((e) => e.overdue);
  if (regsDue.length) {
    const never = regsDue.filter((e) => !e.last).length;
    lines.push(`  spec reviews due: ${regsDue.length} of ${regs.length} registers (${never} never reviewed); oldest: ${oldestDue(all).what}. Run: spec-review on it (dev/skills/README.md, Spec jobs), and offer it on the dev menu (MNT-008)`);
  }
  // SAF-017: flagged to the developer only; her numbers keep showing as written.
  for (const e of all.filter((x) => x.kind === 'crisis-lines' && x.overdue)) {
    const why = [!e.due ? 'no Next due date' : e.due <= today ? `due ${e.due}` : null, ...e.problems].filter(Boolean);
    lines.push(`  crisis numbers re-check due (SAF-017): ${why.join('; ')}. They keep showing to her as written; re-check each line against its operator's or government's own page, then date it in ${e.what}`);
  }
  const bare = unlogged(root);
  if (bare.length) lines.push(`  no grounding log (PMM-005): ${bare.length} skills, ${bare.map((s) => s.split('/').pop()).join(', ')}`);
  // PMM-011 design 2: what is unproven sits beside what is due, so an unproven
  // procedure is never taken for a proven one. Read from the generated list,
  // which check-skills.mjs holds in step at every commit; no list, nothing said.
  const unproven = unprovenCount(root);
  if (unproven) lines.push(`  unproven (PMM-011): ${unproven.count} of ${unproven.of} skills have no recorded passing run; ${UNPROVEN} says why for each`);
  return lines;
}

/** The generated unproven list (PMM-011). */
export const UNPROVEN = `${SKILLS_DIR}/skill-writer/unproven.md`;

/** How many skills the unproven list counts as unproven, of how many; null with no list or none unproven. */
export function unprovenCount(root) {
  let text;
  try {
    text = readFileSync(join(root, UNPROVEN), 'utf8');
  } catch {
    return null;
  }
  const m = /\*\*Unproven:\*\*\s*(\d+)\s+of\s+(\d+)/.exec(text);
  return m && Number(m[1]) > 0 ? { count: Number(m[1]), of: Number(m[2]) } : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  if (process.argv.includes('--all')) {
    const model = currentModel(root);
    console.log(model.id ? `model: ${model.id} (from ${model.from})` : `model: unknown, ${model.from}; the model trigger is skipped`);
    for (const e of currency(root)) {
      console.log(`${e.overdue ? 'DUE ' : 'ok  '} ${e.due ?? 'never'}  ${e.kind.padEnd(8)} ${e.what}`);
      for (const f of e.forward ?? []) console.log(`       brought forward, ${f.why}: ${f.detail}`);
    }
  } else {
    const lines = summary(root);
    console.log(lines.length ? lines.join('\n') : 'nothing due a recheck');
  }
}
