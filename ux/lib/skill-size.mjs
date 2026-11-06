// PMM-015 design 2, the owner's word limit (A-074, T-600): "No skill is so long
// it misses its own rules. What one run reads stays under 2,500 words: the main
// page under 1,000, each part under 1,500." Set-up passed the published line
// limit and still lost rules in length (T-598), so every skill is held in words.
//
// A part is a .md file SKILL.md links to by a relative path, or names in
// backticks from its folder: what a run can be sent to read. That reaches
// outside the skill's folder too (a shared file, `references/x.md`), resolved
// and counted once; never under data/ or data-sandbox/, and only skill text
// (a file under a skills folder): the spec skills' shared rules sat outside
// every skill's folder and were never counted, so their routes ran past the
// limit with this check green (T-607). Records kept beside a skill and never
// named (a log, cases) are not parts.
//
// A split skill says how it is read, explicitly. Its SKILL.md has a line
// "**Every run reads:** `a.md`, `../x/shared.md`" and a routing table whose
// rows name the parts each situation reads. One run is then each row exactly:
// the body, every file the marker names, and every part the row names; and a
// part that tells the reader to read another skill file ("read" in the sentence
// that links it) must have it in the same row. Material a run works on but is
// not instructed by (a ledger, a log read by section) is left out only by name,
// on a "**Material, not counted:**" line. Such a skill with parts and no
// routing table, or a part no row names, is refused. A skill with parts and
// without the marker is refused too (T-692), all but set-up, measured by its
// exact routes (setup-size.mjs); with no parts, a run is its body. A part that
// is another skill's SKILL.md (a dev- entry's target) costs that skill's
// largest run. A part's opening "Read when …" line, a redirect ("read X
// instead, not this"), and a send another route reads in full beside it, do
// not count as sending the reader on, where the file is measured on a route.
//
// A skill over a limit today is listed in .claude/skills/size-baseline.json at
// its present size. It may not grow, and leaves the list once it is under; the
// list may only shrink against HEAD, so it is never a way round the limit.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { countWords, routeTotals } from './setup-size.mjs';

export const BASELINE = '.claude/skills/size-baseline.json';

const bodyOf = (text) => text.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');

/** Every skill folder: .claude/skills/*, modules/<m>/skills/*, dev/skills/*. */
export function skillDirs(root) {
  const out = [];
  const add = (base) => {
    if (!existsSync(base)) return;
    for (const name of readdirSync(base, { withFileTypes: true })) {
      if (name.isDirectory() && existsSync(join(base, name.name, 'SKILL.md'))) out.push(join(base, name.name));
    }
  };
  add(join(root, '.claude', 'skills'));
  add(join(root, 'dev', 'skills'));
  const mods = join(root, 'modules');
  if (existsSync(mods)) for (const m of readdirSync(mods, { withFileTypes: true })) if (m.isDirectory()) add(join(mods, m.name, 'skills'));
  return out.sort();
}

/** The repository a skill folder sits in: the folder holding .claude/, dev/ or modules/. */
function rootOf(dir) {
  const parts = resolve(dir).split(sep);
  for (let i = parts.length - 2; i > 0; i -= 1) {
    if (parts[i] === 'skills' && ['.claude', 'dev'].includes(parts[i - 1])) return parts.slice(0, i - 1).join(sep) || sep;
    if (parts[i] === 'skills' && i > 2 && parts[i - 2] === 'modules') return parts.slice(0, i - 2).join(sep) || sep;
  }
  return dirname(resolve(dir));
}

// Skill text: what lives under a skills folder, a skill's own or one beside it
// (dev/skills/spec-shared/). A register, a knowledge file, a template or a
// command a skill links to is the material its job works on, held by its own
// limits, not a part.
const SKILL_TEXT = /^(\.claude\/skills|dev\/skills|modules\/[^/]+\/skills)\//;

/** The sentence of `text` around [at, at + len), with \u0000 where the link was. */
function sentenceAt(text, at, len) {
  const before = text.slice(Math.max(0, at - 240), at);
  const after = text.slice(at + len, at + len + 240);
  let start = 0;
  for (const re of [/[.!?][*_`)\]]*\s/g, /\n\s*\n/g, /\|/g]) for (const m of before.matchAll(re)) start = Math.max(start, m.index + m[0].length);
  let end = after.length;
  for (const re of [/[.!?][*_`)\]]*(\s|$)/, /\n\s*\n/, /\|/]) {
    const m = after.match(re);
    if (m) end = Math.min(end, m.index);
  }
  return `${before.slice(start)}\u0000${after.slice(0, end)}`;
}

/**
 * A part's own opening "Read when …" (or "Read once …", "Read if …") sentence,
 * as [start, end), or null: the first line of text below any heading, when it
 * opens that way. It names the situation for reading this part, which may name
 * a sibling ("made by `x.md`", "not `y.md`"), and sends the reader nowhere. It
 * ends at the sentence's end, or earlier at a "then" clause ("; then the part
 * for what she asked"), which does send the reader on and is still checked.
 */
function openingSpan(text) {
  const m = text.match(/^(?:\s*#[^\n]*\n|\s*\n)*([ \t]*(?:\*\*|_)?Read (?:when|once|if)\b)/i);
  if (!m) return null;
  const start = m.index + m[0].length - m[1].length;
  const rest = text.slice(start);
  const ends = [/[.!?][*_`)\]]*(\s|$)/, /\n\s*\n/, /[;,(]\s*then\b/i].map((re) => rest.match(re)).filter(Boolean).map((x) => x.index);
  return [start, start + Math.min(rest.length, ...ends)];
}
const inSpan = (span, at) => Boolean(span) && at >= span[0] && at < span[1];

/**
 * The skill-text .md files a text names from folder `dir`: links by a relative
 * path, and backticked paths that resolve from `dir` (a bare name only if it
 * exists there). Each { file, at, len }, in order; never outside the
 * repository, never under data/ or data-sandbox/, never a file that is missing.
 */
function namedIn(text, dir, top) {
  const out = [];
  const consider = (target, at, len, backticked) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) return;
    const file = resolve(dir, target);
    const fromRoot = relative(top, file).split(sep).join('/');
    if (fromRoot === '..' || fromRoot.startsWith('../') || /^(data|data-sandbox)(\/|$)/.test(fromRoot)) return;
    if (!SKILL_TEXT.test(fromRoot)) return;
    if (backticked && !/^\.{1,2}\//.test(target) && !existsSync(join(dir, target))) return;
    if (!existsSync(file)) return;
    out.push({ file, at, len });
  };
  for (const m of text.matchAll(/\]\(<?([^)\s#>]+\.md)>?(?:#[^)]*)?\)/g)) consider(m[1], m.index, m[0].length, false);
  for (const m of text.matchAll(/`([^`\s]+\.md)`/g)) consider(m[1], m.index, m[0].length, true);
  return out;
}

/** The files named on SKILL.md's "**<label>:**" line, or null where there is no such line. */
function markerFiles(text, label, dir, top) {
  const line = text.split('\n').find((l) => l.replace(/^\s*[-*]\s+/, '').startsWith(`**${label}:**`));
  return line === undefined ? null : new Set(namedIn(line, dir, top).map((n) => n.file));
}

/**
 * The parts SKILL.md names: every skill-text .md file it links to by a
 * relative path, or names in backticks from its folder, each resolved and
 * counted once. Never SKILL.md itself, and never a file its "**Material, not
 * counted:**" line names. Each is { name, file, always }: its path from the
 * skill's folder, its full path, and whether its "**Every run reads:**" line
 * names it.
 */
export function linkedParts(dir, root = rootOf(dir)) {
  const text = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  const top = resolve(root);
  const self = resolve(dir, 'SKILL.md');
  const always = markerFiles(text, 'Every run reads', dir, top) ?? new Set();
  const material = markerFiles(text, 'Material, not counted', dir, top) ?? new Set();
  const found = new Map();
  for (const { file } of namedIn(text, dir, top)) {
    if (file === self || material.has(file)) continue;
    found.set(file, { name: relative(resolve(dir), file).split(sep).join('/'), file, always: always.has(file) });
  }
  return [...found.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * A split skill's routes (one with an "**Every run reads:**" line), or null:
 * { routes: [{ label, files }], faults: [] }. A route is a routing-table row
 * naming a part; its files are every file the marker names and every part the
 * row names. Faults: no routing table, a part no route names, and a part that
 * sends the reader on to a skill file its route does not name.
 */
export function routesOf(dir, root = rootOf(dir)) {
  const text = bodyOf(readFileSync(join(dir, 'SKILL.md'), 'utf8'));
  const top = resolve(root);
  const always = markerFiles(text, 'Every run reads', dir, top);
  if (!always) return null;
  const material = markerFiles(text, 'Material, not counted', dir, top) ?? new Set();
  const self = resolve(dir, 'SKILL.md');
  const parts = linkedParts(dir, root);
  const partFiles = new Set(parts.map((p) => p.file));
  const show = (f) => relative(top, f).split(sep).join('/');
  const routes = [];
  const faults = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|') || /^\|[-| :]+\|$/.test(line)) continue;
    const named = namedIn(line, dir, top).map((n) => n.file).filter((f) => partFiles.has(f) && !always.has(f));
    if (!named.length) continue;
    const label = line.split('|')[1].replace(/[*`_]/g, '').replace(/\s+/g, ' ').trim();
    routes.push({ label, files: [...new Set([...always, ...named])] });
  }
  const key = relative(top, dir).split(sep).join('/');
  if (parts.some((p) => !p.always) && !routes.length) faults.push(`${key}/SKILL.md: it has parts and an **Every run reads:** line but no routing table naming them, so what one run reads cannot be measured (A-074, PMM-015)`);
  else for (const p of parts) if (!p.always && !routes.some((r) => r.files.includes(p.file))) faults.push(`${key}/SKILL.md names ${show(p.file)}, but no route reads it: name it in a routing row, on **Every run reads:**, or on **Material, not counted:** (A-074, PMM-015)`);
  // A file some route of this skill reads (or every run does) is measured
  // already; a part may name it as the situation for reading itself, or as the
  // part to read instead, without sending the reader on (T-692). A name on no
  // route is never excused, so nothing goes unmeasured.
  const onSomeRoute = new Set([...always, ...routes.flatMap((r) => r.files)]);
  for (const r of routes) {
    for (const f of r.files) {
      const ptext = readFileSync(f, 'utf8');
      const opening = openingSpan(ptext);
      for (const n of namedIn(ptext, dirname(f), top)) {
        if (n.file === f || n.file === self || r.files.includes(n.file) || material.has(n.file)) continue;
        const sentence = sentenceAt(ptext, n.at, n.len);
        if (!/\bread(s|ing)?\b/i.test(sentence)) continue;
        if (onSomeRoute.has(n.file) && (inSpan(opening, n.at) || /\binstead\b|\bnot this\b/i.test(sentence))) continue;
        // Sent on when something comes up mid-run ("once she has named one, read
        // `care-team.md`"): measured where another route reads all this one
        // does and that file too, so the run it becomes is a route already.
        if (routes.some((o) => o !== r && o.files.includes(n.file) && r.files.every((x) => o.files.includes(x)))) continue;
        faults.push(`${show(f)} sends the reader to ${show(n.file)}, which its route "${r.label}" in ${key}/SKILL.md does not name (A-074, PMM-015)`);
      }
    }
  }
  return { routes, faults: [...new Set(faults)] };
}

/** The names of the parts SKILL.md names, each from the skill's folder (see linkedParts). */
export function partsOf(dir, root) {
  return linkedParts(dir, root).map((p) => p.name);
}

/**
 * Each skill's measures: { key, body, parts: [{name, path, words, always}], run, worst, routes, faults }.
 *
 * A part that is another skill's SKILL.md (a dev- entry's body, a wrapper's
 * target) is read as that skill is: its body and the route it is then sent
 * down. So it costs that skill's largest run, never its SKILL.md alone; a run
 * through a wrapper reads the wrapper and the target's worst route, and the
 * page alone left 2,559 words counted as 854 (T-692).
 */
export function measure(root) {
  const dirs = skillDirs(root);
  const skillOf = new Map(dirs.map((d) => [resolve(d, 'SKILL.md'), d]));
  const memo = new Map();
  const one = (dir, seen) => {
    if (memo.has(dir)) return memo.get(dir);
    const key = relative(root, dir).replace(/\\/g, '/');
    const body = countWords(bodyOf(readFileSync(join(dir, 'SKILL.md'), 'utf8')));
    const words = (f) => countWords(readFileSync(f, 'utf8'));
    // What reading file f costs one run: another skill's page costs its largest run.
    const target = (f) => {
      const d = skillOf.get(resolve(f));
      return d && d !== dir && !seen.has(d) ? one(d, new Set([...seen, dir])) : null;
    };
    const cost = (f) => target(f)?.run ?? words(f);
    const linked = linkedParts(dir, root);
    const parts = linked.map((p) => ({
      name: p.name,
      path: relative(root, p.file).split(sep).join('/'),
      words: words(p.file),
      always: p.always,
    }));
    const named = (label, files) => {
      const t = files.map(target).find((x) => x && x.worst);
      return t ? `${label ? `${label}, ` : ''}through ${t.key}: "${t.worst}"` : label;
    };
    let out;
    const routed = routesOf(dir, root);
    if (routed) {
      const alwaysFiles = linked.filter((p) => p.always).map((p) => p.file);
      const totals = routed.routes.map((r) => ({ label: named(r.label, r.files), words: body + r.files.reduce((n, f) => n + cost(f), 0) }));
      const top = totals.reduce((m, t) => (t.words > m.words ? t : m), { label: named(null, alwaysFiles), words: body + alwaysFiles.reduce((n, f) => n + cost(f), 0) });
      out = { key, body, parts, run: top.words, worst: top.label, routes: totals, faults: routed.faults };
    } else {
      // Set-up's routing table is read route by route by setup-size.mjs, from its
      // **The developer** and **Her** bullets: its largest route is exact.
      const exact = routeTotals(dir);
      const run = exact.problem || !exact.routes.length
        ? body + Math.max(0, ...linked.map((p) => cost(p.file)))
        : Math.max(...exact.routes.map((r) => r.words));
      const faults = [];
      // A skill with parts says how it is read (T-692): without the marker its
      // run is guessed as the body and its largest part, which misses a route
      // that reads two. Set-up alone is exempt, by name: setup-size.mjs reads
      // its routes exactly, from its own **The developer** and **Her** bullets.
      if (parts.length && key !== UNMARKED_EXACT) faults.push(`${key}/SKILL.md: it has parts but no **Every run reads:** line, so what one run reads is guessed, not measured; add the line and a routing table naming each part (A-074, PMM-015)`);
      out = { key, body, parts, run, worst: null, routes: null, faults };
    }
    memo.set(dir, out);
    return out;
  };
  return dirs.map((d) => one(d, new Set()));
}

/** The one skill measured exactly without the marker: set-up, by setup-size.mjs (see measure). */
export const UNMARKED_EXACT = '.claude/skills/set-up';

/** The measures over a limit, as { "<key>/SKILL.md": n, "<key>/<part>": n, "<key> run": n }. */
export function overs(root, limits, measured = measure(root)) {
  const out = {};
  for (const s of measured) {
    if (limits.mainWords && s.body > limits.mainWords) out[`${s.key}/SKILL.md`] = s.body;
    for (const p of s.parts) if (limits.partWords && p.words > limits.partWords) out[p.path] = p.words;
    if (limits.runWords && s.run > limits.runWords) out[`${s.key} run`] = s.run;
  }
  return out;
}

function readJson(text) {
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? (v.over ?? {}) : {}; } catch { return null; }
}

/** The baseline at HEAD, or null where there is no git or no such file there. */
function headBaseline(root) {
  try {
    const text = execFileSync('git', ['-C', root, 'show', `HEAD:${BASELINE}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return readJson(text);
  } catch { return null; }
}

/** Faults against `limits` ({ mainWords, partWords, runWords }); a null limit is not checked. */
export function skillSizeFaults(root, limits, { head = headBaseline(root) } = {}) {
  const faults = [];
  if (!limits.mainWords && !limits.partWords && !limits.runWords) return faults;
  const file = join(root, BASELINE);
  const base = existsSync(file) ? readJson(readFileSync(file, 'utf8')) : {};
  if (base === null) return [`${BASELINE}: not valid JSON; the skills over the word limit cannot be read (PMM-015)`];
  const measured = measure(root);
  const now = overs(root, limits, measured);
  if (limits.runWords) for (const m of measured) faults.push(...m.faults);
  const worst = new Map(measured.map((m) => [`${m.key} run`, m.worst]));
  const what = (k) => (k.endsWith(' run') ? (worst.get(k) ? `one run (${k.slice(0, -4)}: the route "${worst.get(k)}")` : `one run (${k.slice(0, -4)}: SKILL.md and its largest part)`) : k);
  const cap = (k) => (k.endsWith(' run') ? limits.runWords : k.endsWith('/SKILL.md') ? limits.mainWords : limits.partWords);
  for (const [k, n] of Object.entries(now)) {
    if (!(k in base)) faults.push(`${what(k)}: ${n} words, over the limit of ${cap(k)}; split it by situation before adding (A-074, PMM-015)`);
    else if (n > base[k]) faults.push(`${what(k)}: ${n} words, grown past its listed ${base[k]} while over the limit of ${cap(k)}; it may only shrink (A-074, PMM-015)`);
  }
  for (const k of Object.keys(base)) {
    if (!(k in now)) faults.push(`${BASELINE}: "${k}" is now within its limit; remove it from the list, so it cannot grow back (PMM-015)`);
  }
  if (head) {
    for (const [k, n] of Object.entries(base)) {
      if (!(k in head)) faults.push(`${BASELINE}: "${k}" was added to the list; the list may only shrink, so split it instead (PMM-015)`);
      else if (n > head[k]) faults.push(`${BASELINE}: "${k}" raised from ${head[k]} to ${n}; the list may only shrink (PMM-015)`);
    }
  }
  return faults;
}
