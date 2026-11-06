#!/usr/bin/env node
// The code-maintenance fence (HYG-006, "Code is kept current without changing what it
// does"): the code-maintenance job lands its changes with no one approving them, so
// where it may reach is checked by machine. Run by the orchestrator's reviewer on
// every hb-code-maintenance-… branch, and by the job itself before it replies.
//
//   node ux/scripts/check-hygiene-fence.mjs <base> [<head>]   (head: HEAD)
//
// Inside the fence, and nothing else: code files, the dependency files (an
// upgrade the behaviour lock proves unchanged) and its weekly grounding status.
// Never dev/for-you.md: what the job cannot land it fixes or drops, and only a
// question for the developer goes in its reply, for the orchestrator (A-152). Never a test, a check, the behaviour lock or its watch, the commit
// gate, the hook selftest, a threshold, the specs, CLAUDE.md, the safety surface
// or a record. No file may be deleted or renamed.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { changesBetween, corePaths } from './check-only-strengthens.mjs';

const CODE = /\.(m?js|cjs|tsx?|jsx|svelte|css)$/;
const RECORD = /^(data|data-sample|data-sandbox)\//;
const SPECS = /^(dev\/specs|policies)\//;
const TEST = /(^|\/)(test[-_][^/]*|[^/]*\.(test|spec)\.[^/]+|tests?\/.*|__tests__\/.*)$/;
const CHECK = /^(ux\/scripts\/check-[^/]+|ux\/lib\/(run-)?checks\.mjs|\.claude\/hooks\/selftest\.mjs|\.claude\/hooks\/git\/.*)$/;
const LOCKED = ['CLAUDE.md', '.claude/thresholds.json', '.claude/THRESHOLDS.md'];
// The lock and its watch, and every runner behaviour-snapshot.mjs's probes() starts
// (the rule tests are refused as tests): edit a runner and the probe judges nothing.
const JUDGES = [
  'ux/scripts/behaviour-snapshot.mjs', 'ux/scripts/upkeep-watch.mjs', '.claude/jobs/code-maintenance-snapshot.json',
  '.claude/hooks/selftest.mjs', 'ux/test/register.mjs', 'ux/test/run.mjs', 'dev/ui/scripts/test.mjs',
  'ux/scripts/speed-check.mjs',
];
const DEPENDENCIES = /(^|\/)(package(-lock)?\.json|npm-shrinkwrap\.json)$/;
const MANIFEST = /(^|\/)package\.json$/;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'overrides'];
const PROPOSALS = ['.claude/jobs/code-maintenance-grounding.md'];
// The job keeps its own list of sources current (T-458), but only the table of them:
// the reason behind them and the developer's own rules stay as the developer set them.
const SOURCES = '.claude/jobs/code-maintenance-sources.md';
const LIVE = 'Live sources';

/** Whether the sources file changed nothing outside its Live sources section; anything else fails closed. */
export function liveSourcesOnly(before, after) {
  const rest = (text) => {
    const parts = text.split(/^(?=## )/m);
    if (parts.filter((x) => x.startsWith(`## ${LIVE}\n`)).length !== 1) throw new Error('no single live section');
    return parts.filter((x) => !x.startsWith(`## ${LIVE}\n`)).join('');
  };
  try {
    return typeof before === 'string' && typeof after === 'string' && rest(before) === rest(after);
  } catch {
    return false;
  }
}

/**
 * Whether a package.json changed nothing outside its dependency fields. `before`
 * is null for a file added; anything unreadable fails closed. An edge-case run of
 * 2026-10-29 rewrote ux/package.json's check script to `true`, and it passed.
 */
export function dependenciesOnly(before, after) {
  const rest = (text) => {
    const o = JSON.parse(text);
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('not an object');
    for (const f of DEPENDENCY_FIELDS) delete o[f];
    return o;
  };
  const canon = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? v.map(canon) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))) : v);
  try {
    if (typeof after !== 'string' || (before !== null && typeof before !== 'string')) return false;
    return JSON.stringify(canon(before === null ? {} : rest(before))) === JSON.stringify(canon(rest(after)));
  } catch {
    return false;
  }
}

/**
 * What a change set breaks of the fence. `changes`: { status, path, binary?,
 * before?, after? } (a package.json's text at base and head); `core`: the safety paths.
 */
export function outsideFence(changes, core) {
  const out = [];
  for (const { status, path: p, binary, before, after } of changes) {
    const safety = core.some((k) => (k.endsWith('/') ? p.startsWith(k) : p === k));
    if (safety) out.push(`${p}: safety is the developer's, never a cleanup's`);
    else if (RECORD.test(p)) out.push(`${p}: a record, never code hygiene's`);
    else if (SPECS.test(p) || LOCKED.includes(p)) out.push(`${p}: the developer's standing rules`);
    else if (TEST.test(p)) out.push(`${p}: a test; a cleanup that needs one changed has changed behaviour`);
    else if (CHECK.test(p) || JUDGES.includes(p)) out.push(`${p}: a check, the gate or the behaviour lock, which judges the change`);
    else if (/^[DR]/.test(status)) out.push(`${p}: ${status.startsWith('D') ? 'deleted' : 'renamed'}; a dead file is a proposal`);
    // An edge-case run of 2026-10-29: a binary file named .js passed, and the lock cannot read one either.
    else if (binary) out.push(`${p}: binary; neither this fence nor the behaviour lock can read what it changed`);
    else if (p === SOURCES) { if (!liveSourcesOnly(before, after)) out.push(`${p}: changes more than its ${LIVE} table; the reason and the developer's rules are theirs`); }
    else if (MANIFEST.test(p) && !dependenciesOnly(before, after)) out.push(`${p}: changes more than its dependency fields (${DEPENDENCY_FIELDS.join(', ')})`);
    else if (!CODE.test(p) && !DEPENDENCIES.test(p) && !PROPOSALS.includes(p)) out.push(`${p}: not a code or dependency file`);
  }
  return out;
}

/**
 * The commits that cite a safety row, read by their whole message, subject and body:
 * a body citing one passed while only subjects were read, though
 * check-only-strengthens reads bodies (edge-case review, T-330). Each finding names
 * the commit by its subject.
 */
export function safetyCited(messages) {
  return messages
    .filter((m) => /\b(SAF|SPL)-\d{3}\b/.test(m))
    .map((m) => `"${m.split('\n')[0]}": cites a safety row, which only the developer changes`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) {
    console.error('usage: check-hygiene-fence.mjs <base> [<head>]');
    process.exit(2);
  }
  // A package.json is judged on its text at the merge base and at head, as changesBetween reads base...head.
  const fork = execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim();
  const show = (rev, p) => {
    try {
      return execFileSync('git', ['show', `${rev}:${p}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return null;
    }
  };
  const changes = changesBetween(base, head).map((c) => (MANIFEST.test(c.path) || c.path === SOURCES ? { ...c, before: show(fork, c.path), after: show(head, c.path) } : c));
  const found = outsideFence(changes, corePaths());
  const messages = execFileSync('git', ['log', '--format=%B%x00', `${base}..${head}`], { encoding: 'utf8' }).split('\0').map((m) => m.trim()).filter(Boolean);
  found.push(...safetyCited(messages));
  if (found.length) {
    console.error(`UPKEEP FENCE CHECK FAILED (HYG-006)\n\n  - ${found.join('\n  - ')}\n\n  Leave it for the developer: one plain question in your reply, which the orchestrator puts on dev/for-you.md, and "needs you" in the report.`);
    process.exit(1);
  }
  console.log('upkeep fence check: the branch changes code, dependency files, its own sources table and its grounding status only');
}
