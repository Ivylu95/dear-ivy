// `node scripts/check-speed.mjs`: every developer view's server work, timed on
// the real folders, and every record view's, timed on the invented record,
// against one budget (DES-008, "Every view opens, and answers a tap, without a
// wait anyone notices.", design 2).
//
// The views run behind the login, and nothing here signs in or holds a
// credential. So it times what each view's page calls on the server, outside
// Next: the same readers, imported through the app's own aliases, run once to
// warm (the first load after a change pays in full, design 1) and then timed as
// the median of several repeats, which is the server's warm answer to a click.
//
// The budget is `speed.serverWork` in .claude/thresholds.json, stated in the
// row's design column (FND-009). React's cache() memoises only inside a server
// render, and outside one it calls straight through: the Harness walk, shared by
// every part of its page, ran 24 times per timed click and read as 2.4 s where
// the app pays one walk. So the readers' `react` is swapped for a cache() that
// memoises for one timed request, as a render does.
//
// Never her record. The record's views are timed on the invented one in
// data-sample/ (SMP-001), which needs no real data: DEAR_DATA and DEAR_SAMPLE are
// set to it here, before anything reads where the record is, overriding whatever
// the shell said, and the resolver's answer is checked before a single view is
// timed. If it names any other folder, the check stops, having read nothing.
// The sample is smaller than a record a year in, so a record view under budget
// here can still be slow on hers. The admin layout's tab counts, Changes, Hooks
// and Workflow are still not timed (DES-008 Coverage). In a copy without dev/
// (ARC-008) there is nothing to time.

import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAMPLE = join(root, 'data-sample');
process.env.DEAR_DATA = SAMPLE;
process.env.DEAR_SAMPLE = SAMPLE;
const ux = join(root, 'ux');
const admin = join(root, 'dev', 'ui');
if (!existsSync(join(admin, 'lib'))) {
  console.log('speed: no dev/ in this copy (ARC-008), nothing to time');
  process.exit(0);
}

const BUDGET = threshold('speed.serverWork', 'ms');
if (!BUDGET) {
  console.error('speed: no speed.serverWork in .claude/thresholds.json; run node ux/scripts/thresholds.mjs');
  process.exit(1);
}
const REPEATS = 7;

process.env.DEAR_HARNESS ??= join(root, '.claude');
process.env.CLAUDE_PROJECT_DIR ??= root;
process.env.DEAR_HOOK_STRICT ??= '1';

// The app's aliases (@/ for ux, @admin/ for dev/ui) and its extensionless
// imports, resolved as Next resolves them; its .js files are modules. The
// cache() swapped in keys each argument by identity, a Map per argument, as
// React's does.
const HOOKS = `
let ux, admin;
export function initialize(data) { ux = data.ux; admin = data.admin; }
const EXT = ['', '.js', '.mjs', '/index.js'];
const REQUEST_CACHE = 'data:text/javascript,' + encodeURIComponent(
  'const DONE = Symbol(); export function cache(fn) { return (...args) => { const store = globalThis.__speedRequest; if (!store) return fn(...args);' +
  ' let node = store.get(fn); if (!node) store.set(fn, (node = new Map()));' +
  ' for (const a of args) { let next = node.get(a); if (!next) node.set(a, (next = new Map())); node = next; }' +
  ' if (!node.has(DONE)) node.set(DONE, fn(...args)); return node.get(DONE); }; }');
const ours = (url) => url && (url.startsWith(ux) || url.startsWith(admin)) && !url.includes('/node_modules/');
async function find(spec, context, next) {
  if (spec === 'react' && ours(context.parentURL)) return { url: REQUEST_CACHE, shortCircuit: true };
  let base = null;
  if (spec.startsWith('@/')) base = ux + spec.slice(1);
  else if (spec.startsWith('@admin/')) base = admin + spec.slice(6);
  if (base) {
    for (const ext of EXT) {
      try { return await next(base + ext, context); } catch {}
    }
  }
  if (spec.startsWith('.') && !/\\.[cm]?js$/.test(spec)) {
    for (const ext of EXT.slice(1)) {
      try { return await next(spec + ext, context); } catch {}
    }
  }
  // A package path without its extension (\`next/headers\`), as Next allows.
  if (/^(@[^/]+\\/)?[^/.@][^/]*\\/.+/.test(spec) && !/\\.\\w+$/.test(spec)) {
    try { return await next(spec, context); } catch { return next(spec + '.js', context); }
  }
  return next(spec, context);
}
export async function resolve(spec, context, next) {
  return find(spec, context, next);
}
export async function load(url, context, next) {
  if (url.endsWith('.js') && ours(url)) {
    return next(url, { ...context, format: 'module' });
  }
  return next(url, context);
}`;
const href = (dir) => pathToFileURL(dir).href;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`, { data: { ux: href(ux), admin: href(admin) } });

const lib = (name) => import(href(join(admin, 'lib', name)));
const { specsView, harnessView } = await lib('harness.js');
const { specGraphLayout } = await lib('spec-graph.js');
const { readForYou } = await lib('for-you.js');
const { readCodeMap } = await lib('code-map.js');
const { readAgreements } = await lib('agreements.js');
const { readEvals } = await lib('evals.js');

// One entry per view, calling what its page calls: a folder tab's layout reads
// the tree (FolderLayout), its overview the top level (FolderOverview), and a
// file page the file. A file view is timed on the largest register, the slowest
// page that view serves.
const VIEWS = [
  ['Specs Register, overview', () => (specsView.getTree(), specsView.getTop())],
  ['Specs Register, a register', () => (specsView.getTree(), specsView.getPath('system/dev.md'))],
  ['Specs Register, graph', () => specGraphLayout()],
  ['Harness, overview', () => (harnessView.getTree(), harnessView.getTop())],
  ['Harness, a skill', () => (harnessView.getTree(), harnessView.getPath('skills/set-up/SKILL.md'))],
  ['For you', () => readForYou()],
  ['Agreements', () => readAgreements()],
  ['Evals', () => readEvals()],
  // The code map's reader is async: it asks git for the file list.
  ['Code map', () => readCodeMap()],
];

// The record's views, on the invented record. Each entry calls what its page,
// its rail and the dashboard layout call (ux/app/(dashboard)/), the layout's
// identity and tab counts with every one.
const { RECORDS, SAMPLE_EXISTS } = await import(href(join(ux, 'lib', 'data-dir.js')));
if (!existsSync(join(SAMPLE, 'IS_SAMPLE')) || !SAMPLE_EXISTS) {
  console.log('speed: no invented record in data-sample/, so the record views are not timed');
} else if (RECORDS.real.dir !== SAMPLE || RECORDS.sample.dir !== SAMPLE) {
  console.error(`speed: the record resolved to ${RECORDS.real.dir}, not the invented one; nothing was timed, and her record is never read here`);
  process.exit(1);
} else {
  const c = await import(href(join(ux, 'lib', 'content.js')));
  // A view timed on an empty read would pass for nothing: the invented timeline
  // and people must come back filled before any of them is timed.
  if (!(await c.getTimeline()).filled || !(await c.getPeople()).length) {
    console.error('speed: the invented record read back empty, so a record view timed here would time nothing; check data-sample/ and the resolver');
    process.exit(1);
  }
  const layout = () => Promise.all([c.getIdentity(), c.getNavCounts()]);
  const page = (...reads) => () => Promise.all([layout(), ...reads.map((r) => r())]);
  const person = async () => {
    const [first] = await c.getPeople();
    const slug = first?.slug;
    const p = slug ? await c.getPerson(slug) : null;
    return Promise.all([c.getMentions(), p ? c.getMentions(p.name) : null, c.getPronouns()]);
  };
  VIEWS.push(
    ['Record, home', page(c.getHome, c.getPronouns, c.getToday)],
    ['Record, timeline', page(c.getTimeline, c.getPronouns)],
    ['Record, people', page(c.getPeople)],
    ['Record, a person', page(person)],
    ['Record, journal', page(c.getJournal)],
    ['Record, me', page(c.getMe)],
    ['Record, calendar', page(c.getCalendar, c.getToday)],
    ['Record, loops', page(c.getOpenLoops)],
    ['Record, therapy', page(c.getTherapy, c.getOpenLoops)],
    ['Record, safety', page(c.getSafetyPlan)],
    ['Record, about', page(c.getIndex, c.getLastSession)],
  );
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const over = [];
// One request: a fresh cache, as each render gets. A reader that returns a
// promise is timed to its answer.
const request = async (run) => {
  globalThis.__speedRequest = new Map();
  const t = performance.now();
  await run();
  return performance.now() - t;
};
for (const [name, run] of VIEWS) {
  await request(run);
  const times = [];
  for (let i = 0; i < REPEATS; i++) times.push(await request(run));
  const ms = Math.round(median(times));
  const fail = ms > BUDGET;
  if (fail) over.push(name);
  console.log(`${fail ? 'SLOW' : 'ok  '} ${String(ms).padStart(5)} ms  ${name}`);
}

if (over.length) {
  console.error(`\nspeed: ${over.length} view(s) over the ${BUDGET} ms budget (DES-008): ${over.join(', ')}. Profile the reader it names; cache it on the file's version (design 1) before raising the budget.`);
  process.exit(1);
}
console.log(`\nspeed: the ${VIEWS.length} timed views' server readers (the record's on the invented one) are under ${BUDGET} ms warm, timed outside the server`);
