// SMP-008, "Every feature and module the harness has is shown in the fabricated
// record.", with SMP-007 for time: data-sample/ shows everything the harness can
// do, and stays current while the harness grows.
//
//   node scripts/check-sample.mjs     (runs as part of `npm run check`)
//
// What must be covered is read from the harness, never listed here by hand, so
// the change that adds a module, a view, a record shape or a profile status is
// the change that fails this until the sample shows it:
//
//   modules    every module's standing files are filled, not left blank, and
//              every growing folder holds something
//   shapes     every folder shape her record uses (a person as a folder, a
//              topic under therapy) has one in the sample. Compared as shapes —
//              a name that is not the harness's own becomes `*` — so no name
//              from data/ is printed or needed
//   views      every dashboard view is named in VIEW_FEEDS below, and what feeds
//              it is filled
//   profile    every section holds a question, and every status is shown
//   time       enough "Coming up" dates are still ahead of today
//   people     every person is named on the timeline, or their page shows no
//              mentions
//   template   the person template keeps its "Last confirmed" field (MEM-012)
//              and its "Not yet known" line (MEM-013)
//
// Nothing here writes. Fixing a finding is the sample-data-generator skill.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPeople } from '../../.claude/hooks/lib/people.mjs';
import { CORE_DATA, readModules } from '../../.claude/hooks/lib/modules.mjs';
import { parseProfile, SECTIONS, STATUSES } from '../../.claude/hooks/lib/profile-schema.mjs';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SAMPLE = join(repoRoot, 'data-sample');

// The routes, read from the source: lib/views.js is compiled by Next, not a
// module node can import. VIEW_ICON is the list the rail draws.
const viewsSource = readFileSync(join(repoRoot, 'ux', 'lib', 'views.js'), 'utf8');
const ROUTES = [
  ...(/export const VIEW_ICON = \{([\s\S]*?)\n\};/.exec(viewsSource)?.[1] ?? '').matchAll(/^\s*'(\/[^']*)':/gm),
].map((m) => m[1]);
if (!ROUTES.length) throw new Error('check-sample: could not read VIEW_ICON from ux/lib/views.js');

// What each view reads from the record. `null` is a view over the harness, not
// the record. A new route in lib/views.js fails here until it is added: saying
// what feeds a view is how the sample learns it has to show it.
const VIEW_FEEDS = {
  '/': [`${CORE_DATA}/state/now.md`],
  '/timeline': [`${CORE_DATA}/timeline.md`],
  '/people': [`${CORE_DATA}/people/`],
  '/calendar': [`${CORE_DATA}/calendar/calendar.md`],
  '/journal': [`${CORE_DATA}/journal/`],
  '/me': ['about_me', 'what_i_want', 'what_helps', 'how_to_talk_to_me', 'patterns'].map((f) => `${CORE_DATA}/me/${f}.md`),
  '/therapy': ['therapy/what_im_working_on.md', 'therapy/sessions/'],
  '/loops': [`${CORE_DATA}/state/open_loops.md`],
  '/safety': ['safety/safety_plan.md'],
  '/about': null,
  '/harness': null,
  '/specs': null,
  '/workflow': null,
  '/changes': null,
  '/backlog': null,
  '/codemap': null,
  '/stack': null,
  '/agreements': null,
  '/evals': null,
};

// SMP-007 states both (FND-009).
const MIN_COMING_UP = threshold('sample.minComingUp', 'dates');
const MIN_PEOPLE = 4;
const NOTICE_DAYS = threshold('sample.notice', 'days');
// A check never runs against a guessed line: unreadable, it says so and fails.
if (!MIN_COMING_UP || !NOTICE_DAYS) {
  console.error('SAMPLE CHECK FAILED: its thresholds cannot be read from .claude/thresholds.json (FND-009). Run: node ux/scripts/thresholds.mjs');
  process.exit(1);
}
const RECORD_SKIP = new Set(['archive', 'archive-local']);

const findings = [];
const warnings = [];
const toPosix = (p) => p.split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function walk(dir, { dirsOnly = false } = {}) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const isDir = statSync(full).isDirectory();
    if (isDir) out.push(full, ...walk(full, { dirsOnly }));
    else if (!dirsOnly) out.push(full);
  }
  return out;
}

// A folder shows something when it holds more than its README.
const holdsSomething = (dir) => existsSync(dir) && readdirSync(dir).some((n) => n !== 'README.md');

// A file is filled when it exists, is not its blank template, and has a line
// beyond headings and table rules.
const blank = new Map(); // record path -> its blank template's text, from the modules
function filled(file, rel) {
  if (!existsSync(file)) return false;
  const text = read(file);
  if (blank.get(rel) === text) return false;
  return text.split('\n').some((l) => l.trim() && !/^(#|\|[\s|:-]*$)/.test(l.trim()));
}

function checkFeed(path, why) {
  const full = join(SAMPLE, path);
  if (path.endsWith('/')) {
    if (!holdsSomething(full)) findings.push(`${path} is empty, so ${why} shows nothing`);
  } else if (!filled(full, path)) {
    findings.push(`${path} is missing or blank, so ${why} shows nothing`);
  }
}

// ── modules ──────────────────────────────────────────────────────────────────
const known = new Set(); // path segments that are the harness's own names
let moduleCount = 0;
for (const { name: mod, shapes, grows } of readModules(repoRoot)) {
  moduleCount++;
  for (const [template, target] of shapes) {
    const src = join(repoRoot, template);
    const files = statSync(src).isDirectory()
      ? walk(src).filter((f) => statSync(f).isFile()).map((f) => [f, join(target, relative(src, f))])
      : [[src, target]];
    for (const [from, to] of files) {
      const rel = toPosix(join(to)).replace(/^\.\//, '');
      rel.split('/').slice(0, -1).forEach((s) => known.add(s));
      blank.set(rel, read(from));
      const dest = join(SAMPLE, rel);
      if (!existsSync(dest)) findings.push(`${rel} is missing (module ${mod} starts every record with it)`);
      else if (!rel.endsWith('README.md') && read(dest) === blank.get(rel)) findings.push(`${rel} is still the blank template (module ${mod})`);
    }
  }
  for (const folder of grows) {
    folder.split('/').forEach((s) => known.add(s));
    if (!holdsSomething(join(SAMPLE, folder))) findings.push(`${folder}/ holds nothing (module ${mod} grows it)`);
  }
}

// ── shapes ───────────────────────────────────────────────────────────────────
const shapeOf = (root) =>
  new Set(
    walk(root, { dirsOnly: true })
      .map((d) => toPosix(relative(root, d)).split('/'))
      .filter((segs) => !RECORD_SKIP.has(segs[0]))
      .map((segs) => segs.map((s) => (known.has(s) ? s : '*')).join('/')),
  );
const sampleShapes = shapeOf(SAMPLE);
for (const shape of shapeOf(join(repoRoot, 'data'))) {
  if (!sampleShapes.has(shape)) findings.push(`no folder shaped ${shape}/ — the real record uses one, so the views that read it are untested`);
}

// ── views ────────────────────────────────────────────────────────────────────
for (const route of ROUTES) {
  if (!(route in VIEW_FEEDS)) {
    findings.push(`view ${route} is not in VIEW_FEEDS in scripts/check-sample.mjs; say what feeds it (null if it reads the harness)`);
    continue;
  }
  for (const path of VIEW_FEEDS[route] ?? []) checkFeed(path, `the ${route} view`);
}

// ── profile ──────────────────────────────────────────────────────────────────
const profileName = readdirSync(SAMPLE).find((n) => n.toLowerCase() === 'profile.yaml');
if (!profileName) findings.push('the profile is missing');
else {
  const { data } = parseProfile(read(join(SAMPLE, profileName)));
  const seen = new Set();
  for (const section of SECTIONS) {
    const questions = Object.values(data[section] ?? {});
    if (!questions.length) findings.push(`the profile's ${section} section holds no question`);
    questions.forEach((q) => seen.add(q.status));
  }
  for (const status of STATUSES) {
    if (!seen.has(status)) findings.push(`no profile question is ${status}, so that state is never shown`);
  }
}

// ── time ─────────────────────────────────────────────────────────────────────
const today = new Date().toLocaleDateString('en-CA');
const warnFrom = new Date(Date.now() + NOTICE_DAYS * 86400000).toLocaleDateString('en-CA');
const calendarPath = join(SAMPLE, CORE_DATA, 'calendar', 'calendar.md');
if (existsSync(calendarPath)) {
  const comingUp = read(calendarPath).split(/^## /m).find((s) => s.startsWith('Coming up')) ?? '';
  const dates = [...comingUp.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm)].map((m) => m[1]);
  const ahead = dates.filter((d) => d >= today).length;
  if (ahead < MIN_COMING_UP) findings.push(`calendar has ${ahead} "Coming up" date(s) after ${today}; it needs ${MIN_COMING_UP}, or the forward views empty out`);
  // Notice before it blocks: this fails by the calendar alone, so say so while
  // there is still time to refresh it in a change of its own.
  else if (dates.filter((d) => d >= warnFrom).length < MIN_COMING_UP) {
    warnings.push(`calendar: fewer than ${MIN_COMING_UP} "Coming up" dates left after ${warnFrom}; this check fails once they pass. Refresh it now`);
  }
}

// ── people ───────────────────────────────────────────────────────────────────
const { people } = readPeople(join(SAMPLE, CORE_DATA, 'people'));
if (people.length < MIN_PEOPLE) findings.push(`${people.length} people on file; the sample needs ${MIN_PEOPLE}`);
const timeline = existsSync(join(SAMPLE, CORE_DATA, 'timeline.md')) ? read(join(SAMPLE, CORE_DATA, 'timeline.md')).toLowerCase() : '';
for (const person of people) {
  const slug = String(person.slug ?? person).toLowerCase();
  if (!new RegExp(`\\b${slug}\\b`).test(timeline)) findings.push(`people/${slug} is never named on the timeline, so their page shows no mentions`);
}

// ── person template ──────────────────────────────────────────────────────────
// MEM-012 design 1: a standing fact carries the date it was last known true,
// starting from the template every new person page is made from.
const personTemplate = join(repoRoot, 'modules', 'core', 'templates', 'a-person', 'person.md');
if (!existsSync(personTemplate)) findings.push('modules/core/templates/a-person/person.md is missing, so no person page starts with a "Last confirmed" date (MEM-012)');
else if (!/^\*\*Last confirmed:\*\*/m.test(read(personTemplate))) findings.push('the person template has no "**Last confirmed:**" field, so a standing fact about a person carries no age (MEM-012)');
// MEM-013 design 2: a gap is written as not yet known, never closed by asking.
if (existsSync(personTemplate) && !/^\*\*Not yet known:\*\*/m.test(read(personTemplate))) findings.push('the person template has no "**Not yet known:**" line, so a gap on a person page has nowhere to be marked (MEM-013)');

for (const w of warnings) console.warn(`  sample check warning: ${w}`);

if (findings.length) {
  console.error(
    `\n  SAMPLE CHECK FAILED\n\n${findings.map((f) => `  - ${f}`).join('\n')}\n\n` +
      '  The invented record has stopped showing everything the harness can do.\n' +
      '  Fill it with the sample-data-generator skill; never by copying from data/.\n' +
      '  See SMP-008 in dev/specs/data/sample.md.\n',
  );
  process.exit(1);
}

console.log(
  `sample check: ${moduleCount} modules, ${ROUTES.length} views, ${sampleShapes.size} folder shapes and every profile status covered`,
);
