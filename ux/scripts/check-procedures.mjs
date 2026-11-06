// Every procedure held to the practice cache (PMM-015, PMM-017, PMM-018).
//
//   node scripts/check-procedures.mjs     (the commit gate and `npm run check`)
//
// The limits a skill or command is measured by live in one file,
// .claude/skills/practice.md, each with its source and whether it refuses or
// warns. This check reads that file at run time and holds no value of its own:
// change the cache and the check follows. Until 2026-10-15 the cache existed and
// nothing read it, so set-up's description ran to ~1,500 characters against a
// published maximum of 1,024 and nothing said so.
//
// Only a value marked `refuse` with a source fails the run. A value marked
// `warn`, or one whose source says "no source", only ever warns (PMM-018). Past
// the cache's own "Next due" date it warns that the values want re-grounding
// (PMM-017). The standard (goal, audience, reads, grounding log) refuses: a skill
// missing any of them fails the run (PMM-002, -005, -009, -012), on the
// developer's yes once every skill met it ("go ahead with phase E").

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The when-to-read rule (PMM-015) is the gate's run to switch on, so a bare call, as the rule tests make, measures the practice values alone.
export const routing = { whenToRead: false };

export const CACHE = '.claude/skills/practice.md';

// Tokens, estimated from characters at 2.7 per token. Measured on 2026-10-15
// with the model's own count (`claude -p --output-format json`, input tokens
// with the file as the system prompt, less a one-character baseline):
// set-up/SKILL.md 17,817 chars → 6,365 tokens (2.80 per token), repair.md 2.80,
// journal/SKILL.md 2.82, a-person/SKILL.md 3.06. The old chars/4 put set-up at
// ~4,450 and let it pass a 5,000 cap it was well over; a word count does worse
// here (about 2.1 tokens a word, against the usual 1.35). 2.7 sits below every
// measured skill body, so the estimate errs high, never low. A table-heavy file
// runs denser still (practice.md, 2.34), so a body that is mostly table may yet
// be under-counted; re-measure when the cache is re-grounded (PMM-017).
export const CHARS_PER_TOKEN = 2.7;
export const estimateTokens = (text) => Math.ceil(String(text).length / CHARS_PER_TOKEN);

/** The cache as { values: Map(key → {value, enforce, source, refuses}), nextDue }, or throws. */
export function readCache(root) {
  const file = join(root, CACHE);
  if (!existsSync(file)) throw new Error(`no practice cache at ${CACHE}; the limits procedures are measured by live there (PMM-017)`);
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const values = new Map();
  for (const line of text.split('\n')) {
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length < 4 || !/^[a-z]+\.[a-zA-Z]+$/.test(cells[0])) continue;
    const [key, value, enforce, source] = cells;
    const unsourced = !source || /no source/i.test(source);
    values.set(key, { value, enforce, source, refuses: enforce === 'refuse' && !unsourced });
  }
  const nextDue = text.match(/\*\*Next due:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  return { values, nextDue };
}

function loadYaml(root) {
  for (const r of [root, process.env.DEAR_GIT_ROOT].filter(Boolean)) {
    try {
      return createRequire(join(r, 'ux', 'package.json'))('js-yaml');
    } catch {
      // Not installed there; try the next.
    }
  }
  return null;
}

const list = (dir) => {
  try {
    return readdirSync(dir).filter((n) => !n.startsWith('_') && n !== 'node_modules');
  } catch {
    return [];
  }
};
const mdFiles = (dir) =>
  list(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return mdFiles(p);
    return n.endsWith('.md') ? [p] : [];
  });

/** Every procedure: { kind, name, rel, file, folder? }. */
function procedures(root) {
  const out = [];
  const skillDirs = ['.claude/skills', 'dev/skills', ...list(join(root, 'modules')).map((m) => `modules/${m}/skills`)];
  for (const dir of skillDirs) {
    for (const name of list(join(root, dir))) {
      // A `dev-` entry is a pointer to its body in dev/skills/ (ARC-005, T-479): the body is measured, not the pointer.
      // In a copy without dev/ at all (one made for someone else, ARC-008) the pointer only
      // says the skill is the developer's and stops, so there is no procedure to measure;
      // with dev/ there, a pointer whose body is missing is still measured, and refused.
      if (dir === '.claude/skills' && name.startsWith('dev-') && (existsSync(join(root, 'dev', 'skills', name.slice(4), 'SKILL.md')) || !existsSync(join(root, 'dev')))) continue;
      const file = join(root, dir, name, 'SKILL.md');
      if (existsSync(file)) out.push({ kind: 'skill', name, rel: `${dir}/${name}/SKILL.md`, file, folder: join(root, dir, name) });
    }
  }
  for (const dir of ['.claude/commands', 'dev/commands']) {
    for (const n of list(join(root, dir)).filter((x) => x.endsWith('.md'))) {
      out.push({ kind: 'command', name: n.replace(/\.md$/, ''), rel: `${dir}/${n}`, file: join(root, dir, n) });
    }
  }
  return out;
}

function split(text, yaml) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { head: {}, body: text };
  let head = {};
  try {
    head = (yaml ? yaml.load(m[1]) : Object.fromEntries(m[1].split('\n').map((l) => l.match(/^([\w-]+):\s*(.*)$/)?.slice(1) ?? []).filter((p) => p.length))) ?? {};
  } catch {
    // An unparsable header is check-skills.mjs's to refuse.
  }
  return { head, body: text.slice(m[0].length) };
}

const hasContents = (text) => {
  const top = text.split('\n').slice(0, 40);
  return top.some((l) => /^#+\s*(table of )?contents\b/i.test(l)) || top.filter((l) => /^\s*(?:[-*]|\d+\.)\s*\[[^\]]+\]\(#/.test(l)).length >= 3;
};

/**
 * Measure every procedure under `root` against the cache.
 * Returns { refused: [], warned: [], notes: [], standard: {...} }; throws if the cache is missing.
 */
export function checkProcedures(root, { today = new Date().toISOString().slice(0, 10), contextTokens = 200000 } = {}) {
  const { values, nextDue } = readCache(root);
  const yaml = loadYaml(root);
  const refused = [];
  const warned = [];
  const notes = [];
  const num = (key) => {
    const v = values.get(key);
    const n = v ? Number(String(v.value).replace(/,/g, '')) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  // One measurement against one value: refuses only where the cache says it may.
  const over = (key, actual, where, what) => {
    const cap = num(key);
    if (cap === null || actual <= cap) return;
    const v = values.get(key);
    const line = `${where}: ${what} ${actual}, over ${key} ${cap}`;
    if (v.refuses) refused.push(`${line} (refuse; ${v.source.split(' ')[0]})`);
    else warned.push(`${line} (warn${/no source/i.test(v.source) ? ', unsourced, PMM-018' : ''})`);
  };
  for (const key of ['description.maxChars', 'name.maxChars', 'main.maxLines', 'main.maxTokens', 'reference.tocOverLines', 'reference.maxDepth', 'log.maxLines']) {
    if (num(key) === null) notes.push(`the cache has no number for ${key}; not checked`);
  }

  if (nextDue && nextDue < today) warned.push(`${CACHE}: next due ${nextDue}; practice cache due for re-grounding (PMM-017)`);

  let descChars = 0;
  const std = { skills: 0, commands: 0, goal: 0, audience: 0, reads: 0, log: 0 };
  for (const p of procedures(root)) {
    const text = readFileSync(p.file, 'utf8').replace(/\r\n/g, '\n');
    const { head, body } = split(text, yaml);
    const desc = typeof head.description === 'string' ? head.description : '';
    // The listing budget counts what the platform lists: dev/ bodies keep only a dev- entry the model cannot start (ARC-005)
    // and a command the model may not start is left out of its listing, so neither costs it.
    if (!p.rel.startsWith('dev/') && String(head['disable-model-invocation']) !== 'true') descChars += String(head.name ?? p.name).length + desc.length;
    over('description.maxChars', desc.length, p.rel, 'description');
    over('description.listingCutChars', desc.length, p.rel, 'description');
    over('name.maxChars', String(head.name ?? p.name).length, p.rel, 'name');
    if (p.kind !== 'skill') {
      std.commands++;
      continue;
    }

    const lines = body.replace(/\n$/, '').split('\n').length;
    over('main.maxLines', lines, p.rel, 'body lines');
    over('main.maxTokens', estimateTokens(body), p.rel, `body tokens (est. chars/${CHARS_PER_TOKEN})`);

    const dirRel = relative(root, p.folder).replace(/\\/g, '/');
    const others = mdFiles(p.folder).filter((f) => f !== p.file);
    const names = new Set(others.map((f) => relative(p.folder, f).replace(/\\/g, '/')));
    const linksIn = (t, from) => [...t.matchAll(/\]\(([^)#\s]+\.md)/g)].map((m) => join(from, m[1]).replace(/\\/g, '/'));
    // One level deep means one step from SKILL.md: what it links to is level one,
    // and a reference that sends the reader on to anything else is level two.
    const levelOne = new Set(linksIn(body, '.'));
    for (const f of others) {
      const rel = relative(p.folder, f).replace(/\\/g, '/');
      const t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
      const n = t.replace(/\n$/, '').split('\n').length;
      const isLog = /^(log|cases)\.md$/.test(basename(f));
      // Finished items are archived, never carried (PMM-012): a ticked box is a finished item.
      if (isLog && /^\s*[-*]\s+\[[xX]\]/m.test(t)) refused.push(`${dirRel}/${rel}: carries a finished item (a ticked box); archive it, never delete it (PMM-012)`);
      if (isLog) over('log.maxLines', n, `${dirRel}/${rel}`, 'lines');
      else {
        const toc = num('reference.tocOverLines');
        if (toc !== null && n > toc && !hasContents(t)) warned.push(`${dirRel}/${rel}: ${n} lines, over reference.tocOverLines ${toc}, with no contents list near the top (warn)`);
        // Routing and split together (PMM-015): a part the router leads to says, near its top, when to read it.
        // Held for the skills her sessions load (.claude/skills, modules); a dev skill's parts are generated, vendored or case files.
        const shipped = !p.rel.startsWith('dev/');
        const saysWhen = /\b(read when|read this when|loaded by|read by|read before|read fresh|use when|when to read)\b/i;
        if (routing.whenToRead && shipped && levelOne.has(rel) && basename(f) !== 'README.md' && !t.split('\n').slice(0, 12).some((l) => saysWhen.test(l))) {
          refused.push(`${dirRel}/${rel}: ${p.rel} leads to it, but its first lines do not say when to read it (routing, PMM-015)`);
        }
        // A reference that sends the reader on to another reference is two levels deep.
        const deeper = linksIn(t, dirname(rel)).filter((l) => names.has(l) && l !== rel && !levelOne.has(l) && !/^(log|cases)\.md$/.test(basename(l)));
        if (deeper.length) over('reference.maxDepth', 2, `${dirRel}/${rel}`, `links on to ${deeper[0]}, reference depth`);
        // Routing (PMM-015): a part nothing links to is one no situation leads to.
        const linkedFrom = [p.file, ...others.filter((o) => o !== f)].some((o) => {
          const from = o === p.file ? '.' : dirname(relative(p.folder, o).replace(/\\/g, '/'));
          return linksIn(readFileSync(o, 'utf8'), from).includes(rel);
        });
        if (!linkedFrom && basename(f) !== 'README.md') refused.push(`${dirRel}/${rel}: no situation in ${p.rel} leads to it, so it is never read (routing, PMM-015)`);
      }
    }

    std.skills++;
    const has = {
      goal: /^\*\*Goal:\*\*|^##\s+Goal\b/m.test(body),
      audience: /^\*\*Audience:\*\*|^##\s+Audience\b/m.test(body),
      reads: /^\*\*Reads:\*\*|^##\s+Reads\b/m.test(body),
      log: existsSync(join(root, 'dev', 'skills', p.name, 'log.md')) || existsSync(join(p.folder, 'log.md')),
    };
    // Her copy ships without dev/ (DEP-017), where most logs live: there the log is not asked for.
    if (!existsSync(join(root, 'dev'))) has.log = true;
    // One goal (PMM-002): a stated goal of more than one sentence is two goals under one name.
    const goalText = body.match(/^\*\*Goal:\*\*([\s\S]*?)(?:\n\s*\n|(?![\s\S]))/m)?.[1]?.replace(/\s+/g, ' ').trim();
    if (goalText && /[.!?]["')`]*\s+[A-Z`*(]/.test(goalText)) refused.push(`${p.rel}: its **Goal:** runs to more than one sentence, so it states more than one goal; a procedure has one goal (PMM-002)`);
    // Names what it reads (PMM-012): a **Reads:** line with nothing after it names nothing.
    if (has.reads && /^\*\*Reads:\*\*[ \t]*\n(?:[ \t]*\n)*(?![ \t]*(?:[-*]|\d+\.|\|))/m.test(body)) refused.push(`${p.rel}: its **Reads:** line names nothing, so it reads nothing before acting (PMM-012)`);
    const why = { goal: 'no **Goal:** line (PMM-002)', audience: 'no **Audience:** line (PMM-009)', reads: 'no **Reads:** line (PMM-012)', log: `no grounding log at dev/skills/${p.name}/log.md (PMM-005)` };
    for (const k of Object.keys(has)) {
      if (has[k]) std[k]++;
      else refused.push(`${p.rel}: ${why[k]} (standard)`);
    }
  }

  const fraction = values.get('listing.budgetFraction');
  // Over the shared budget, the platform shortens descriptions, and the one cut is the one that stops firing
  // (T-330 edge cases, 2026-10-28: the cache said warn, and this only ever reported).
  const budgetTokens = fraction ? contextTokens * Number(fraction.value) : NaN;
  if (Number.isFinite(budgetTokens) && descChars / CHARS_PER_TOKEN > budgetTokens) {
    const line = `listed descriptions ~${Math.round(descChars / CHARS_PER_TOKEN)} tokens, over listing.budgetFraction ${fraction.value} (~${Math.round(budgetTokens)} tokens at ${contextTokens / 1000}k)`;
    if (fraction.refuses) refused.push(`${line} (refuse)`);
    else warned.push(`${line} (warn): shorten a description before adding one`);
  }
  const listing = fraction
    ? `listed names and descriptions ${descChars} chars (~${Math.round(descChars / CHARS_PER_TOKEN)} tokens) against a listing budget of ${Number(fraction.value) * 100}% of the context window (~${Math.round(contextTokens * Number(fraction.value))} tokens at ${contextTokens / 1000}k)`
    : `descriptions ${descChars} chars`;
  return { refused, warned, notes, standard: std, listing };
}

// ── run ────────────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.CLAUDE_PROJECT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  let result;
  try {
    routing.whenToRead = true;
    result = checkProcedures(root);
  } catch (error) {
    console.error(`\n  PROCEDURE CHECK FAILED\n\n  ${error.message}\n`);
    process.exit(1);
  }
  const { refused, warned, notes, standard: s, listing } = result;
  for (const w of [...warned, ...notes]) console.log(`  warn  ${w}`);
  console.log(`  standard: ${s.skills} skills · goal stated ${s.goal} · audience ${s.audience} · reads ${s.reads} · grounding log ${s.log} (refuses: PMM-002, -009, -012, -005)`);
  console.log(`  listing: ${listing}`);
  if (refused.length) {
    console.error(['', '  PROCEDURE CHECK FAILED', '', ...refused.map((f) => `  - ${f}`), '', `  The limits are ${CACHE}'s; trim the procedure, never the cache, to pass.`, ''].join('\n'));
    process.exit(1);
  }
  console.log(`procedure check: ${s.skills} skills and ${s.commands} commands held to ${CACHE}, 0 refused, ${warned.length} warned`);
}
