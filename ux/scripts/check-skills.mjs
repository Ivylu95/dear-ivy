// Every skill's and command's header parses, and says what dispatch needs.
//
// This is the check behind the index of procedures (PMM-001, design 2): the
// platform lists skills and commands from their headers, so a header that does
// not parse is a procedure nobody can find.
//
//   node scripts/check-skills.mjs     (runs as part of `npm run check`)
//
// A skill is found only through its description: it is the one thing dispatch
// reads. The header is YAML, and an unquoted description that contains a colon
// followed by a space ends early — on 2026-09-27 "waits: no mode starts" did
// that to the spec-manager skill, which then listed as its bare title and could
// not be matched, with nothing reporting it. So each SKILL.md under
// .claude/skills/ and modules/ is parsed the way the loader parses it, and must
// give a `name` matching its folder and a non-empty string `description`.
//
// Commands (.claude/commands/*.md) carry the same header and broke the same
// way: on 2026-10-03 "Optional: a plain yes" left /dev-approve listed with no
// description. Each must parse, be described, and carry
// `disable-model-invocation: true`, so only the developer starts it (PMM-008);
// a stub that points to a body in dev/commands/ must find it there, wherever
// dev/ is (a copy without it, ARC-008, keeps the stubs and not the bodies).
//
// A skill a row's design column names by its SKILL.md path must cite that row's
// ID: the row put a case in the skill, and a skill that drops it drops the rule
// unseen (CON-015, added 2026-10-03). Skipped where the specs are absent (ARC-008).

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEV_DIR, SKILLS_DIR, SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { designTokens } from './design-paths.mjs';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');

// PMM-010 design 2, "run them from ux/scripts/check-skills.mjs": with --evals,
// this runs each skill's firing and scenario tests and keeps the unproven list
// (PMM-011) instead of the header check; the work is in ux/lib/skill-evals.mjs.
if (process.argv.includes('--evals')) {
  const { main } = await import('../lib/skill-evals.mjs');
  const put = (rel, text) => {
    mkdirSync(dirname(join(REPO, rel)), { recursive: true });
    writeFileSync(join(REPO, rel), text);
  };
  process.exit(await main(process.argv.slice(2), REPO, put));
}

// js-yaml from this checkout's ux/, or, in the commit gate's snapshot (which has
// no node_modules), from the real repository's, as check-profile.mjs finds it.
function loadYaml() {
  for (const root of [REPO, process.env.DEAR_GIT_ROOT].filter(Boolean)) {
    try {
      return createRequire(join(root, 'ux', 'package.json'))('js-yaml');
    } catch {
      // Not installed there; try the next.
    }
  }
  console.error('\n  SKILL HEADER CHECK FAILED\n\n  js-yaml is not installed: run npm --prefix ux install\n');
  process.exit(1);
}
const yaml = loadYaml();

const find = (dir) => {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('_')) return []; // archived copies are renamed with a leading underscore
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return find(path);
    return name === 'SKILL.md' ? [path] : [];
  });
};

const faults = [];

/** The file's header as the loader reads it, or null with the fault recorded. */
function header(file) {
  const rel = relative(REPO, file).replace(/\\/g, '/');
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    faults.push(`${rel}: no --- header at the top`);
    return null;
  }
  try {
    return { rel, text, head: yaml.load(m[1]) ?? {} };
  } catch (error) {
    faults.push(`${rel}: the header is not valid YAML (${String(error.reason ?? error.message).split('\n')[0]})`);
    return null;
  }
}

const described = (head) => typeof head.description === 'string' && head.description.trim();

const skills = [join(REPO, '.claude', 'skills'), join(REPO, 'modules')].flatMap(find);
for (const file of skills) {
  const parsed = header(file);
  if (!parsed) continue;
  const { rel, head } = parsed;
  const folder = basename(dirname(file));
  if (head.name !== folder) faults.push(`${rel}: name is "${head.name ?? ''}", the folder is "${folder}"`);
  if (!described(head)) faults.push(`${rel}: no description, so dispatch can never match it`);
  // A-073: a skill is for whoever needs it, so it is never one only the developer can start;
  // a `dev-` entry is the developer's own procedure (ARC-005), his alone to start, so it is exempt.
  if (head['disable-model-invocation'] === true && !folder.startsWith('dev-')) {
    faults.push(`${rel}: "disable-model-invocation: true" means only the developer could start it; a skill is for whoever needs it (A-073)`);
  }
}

// ARC-005: a procedure only development mode uses never keeps an entry under its own
// name, where dispatch could start it in one of her conversations (the
// developer's correction of 2026-10-03). Since T-479 each one keeps a `dev-`
// entry instead, which the developer types and the agent can never start: it
// carries "disable-model-invocation: true", points to its body in dev/skills/,
// and is withheld from every release. A copy without dev/ has no bodies to read.
if (existsSync(join(REPO, SKILLS_DIR))) {
  const bodies = readdirSync(join(REPO, SKILLS_DIR)).filter((n) => existsSync(join(REPO, SKILLS_DIR, n, 'SKILL.md')));
  const manifest = join(REPO, SKILLS_DIR, 'release', 'manifest.json');
  const never = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).never ?? [] : [];
  for (const name of bodies) {
    if (existsSync(join(REPO, '.claude', 'skills', name))) {
      faults.push(`.claude/skills/${name}/: ${name} is a development skill, so its entry is .claude/skills/dev-${name}/, never its own name (ARC-005)`);
    }
    if (!existsSync(join(REPO, '.claude', 'skills', `dev-${name}`, 'SKILL.md'))) {
      faults.push(`${SKILLS_DIR}/${name}/SKILL.md: no .claude/skills/dev-${name}/ entry, so the developer cannot type it (ARC-005, T-479)`);
    }
  }
  for (const entry of readdirSync(join(REPO, '.claude', 'skills')).filter((n) => n.startsWith('dev-'))) {
    const rel = `.claude/skills/${entry}/SKILL.md`;
    const parsed = header(join(REPO, rel));
    if (!parsed) continue;
    if (parsed.head['disable-model-invocation'] !== true) faults.push(`${rel}: no "disable-model-invocation: true", so it could start in one of her conversations (ARC-005)`);
    const body = entry.slice('dev-'.length);
    if (!bodies.includes(body)) faults.push(`${rel}: its body ${SKILLS_DIR}/${body}/SKILL.md is missing`);
    else if (!parsed.text.includes(`dev/skills/${body}/SKILL.md`)) faults.push(`${rel}: does not point to its body dev/skills/${body}/SKILL.md`);
    if (!never.includes(`.claude/skills/${entry}/`)) faults.push(`${rel}: not withheld in ${SKILLS_DIR}/release/manifest.json, so it would ship to her copy (ARC-005)`);
  }
}

const commandsDir = join(REPO, '.claude', 'commands');
let commands = [];
try {
  commands = readdirSync(commandsDir).filter((name) => name.endsWith('.md')).map((name) => join(commandsDir, name));
} catch {
  // No commands folder: nothing to check.
}
for (const file of commands) {
  const parsed = header(file);
  if (!parsed) continue;
  const { rel, text, head } = parsed;
  if (!described(head)) faults.push(`${rel}: no description, so the command list shows it bare`);
  if (head['disable-model-invocation'] !== true) {
    faults.push(`${rel}: no "disable-model-invocation: true", so the agent could start it (PMM-008)`);
  }
  // A copy without dev/ (someone else's, ARC-008) holds the stubs and never
  // their bodies: there they are the developer's commands, and they start nothing.
  if (!existsSync(join(REPO, DEV_DIR))) continue;
  for (const [, body] of text.matchAll(/\]\(\.\.\/\.\.\/(dev\/commands\/[^)]+)\)/g)) {
    if (!existsSync(join(REPO, body))) faults.push(`${rel}: its body ${body} is missing`);
  }
}

// Rows whose design column puts a case in a skill: the skill must cite the row.
// Read through designTokens, so it follows the registers in whatever format they
// take (tables until 2026-10-03, sections after).
if (existsSync(join(REPO, SPECS_DIR))) {
  for (const { id, token } of designTokens(REPO)) {
    const skill = token.match(/^\.claude\/skills\/([a-z0-9-]+)\/SKILL\.md$/)?.[1];
    if (!skill) continue;
    const path = join(REPO, '.claude', 'skills', skill, 'SKILL.md');
    if (!existsSync(path)) continue; // a missing path is check-spec-paths' to report
    if (!readFileSync(path, 'utf8').includes(id)) {
      faults.push(`.claude/skills/${skill}/SKILL.md: ${id} puts a case here, but the skill no longer cites ${id}`);
    }
  }
}

// KNW-002 design 1: how well a claim is known travels with it, so every table of
// claims in a practices file (and the template a subject file starts from) has a
// Tier and a Read column, and no row leaves either blank: a row without them
// cannot be quoted in the right voice. `—` is a value (nothing located).
{
  const files = [join(REPO, 'modules', 'core', 'templates', 'look-it-up', 'practices.md')];
  try {
    for (const mod of readdirSync(join(REPO, 'modules'))) {
      const dir = join(REPO, 'modules', mod, 'knowledge');
      if (!existsSync(dir)) continue;
      const walk = (d) => readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        if (n.startsWith('_')) return [];
        return statSync(p).isDirectory() ? walk(p) : n === 'practices.md' ? [p] : [];
      });
      files.push(...walk(dir));
    }
  } catch {
    // No modules folder: nothing to check.
  }
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  for (const file of files.filter(existsSync)) {
    const rel = relative(REPO, file).replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/^\|\s*Practice\s*\|/.test(lines[i])) continue;
      const head = cells(lines[i]).map((c) => c.toLowerCase());
      const tier = head.indexOf('tier');
      const read = head.indexOf('read');
      if (tier < 0 || read < 0) {
        faults.push(`${rel}:${i + 1}: a table of claims has no ${tier < 0 ? 'Tier' : 'Read'} column (KNW-002)`);
        continue;
      }
      for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
        const row = cells(lines[j]);
        if (!row[tier] || !row[read]) {
          faults.push(`${rel}:${j + 1}: a claim with ${!row[tier] ? 'Tier' : 'Read'} blank cannot be quoted at its strength (KNW-002)`);
        } else if (!/^[{<_]/.test(row[tier]) && !/^(1|2|3|—)( \([a-z -]+\))?$/.test(row[tier].replace(/`/g, ''))) {
          // MNT-003 design 2: the columns hold the values the knowledge index fixes
          // (Tier 1, 2, 3 or —, a bracketed note allowed; Read full, record or —), so a citation is never a
          // plausible-looking string. A template's placeholder row is left alone.
          faults.push(`${rel}:${j + 1}: Tier "${row[tier]}" is not 1, 2, 3 or — (MNT-003)`);
        } else if (!/^[{<_]/.test(row[read]) && !/^(full|record|—)$/.test(row[read].replace(/`/g, ''))) {
          faults.push(`${rel}:${j + 1}: Read "${row[read]}" is not full, record or — (MNT-003)`);
        }
      }
    }
  }
  // Design 2: the evidence skill keeps the plain phrases for each strength.
  const skill = join(REPO, '.claude', 'skills', 'look-it-up', 'SKILL.md');
  if (existsSync(skill)) {
    const text = readFileSync(skill, 'utf8');
    for (const need of ['`full`', '`record`', 'tier 1', 'tier 2']) {
      if (!text.includes(need)) faults.push(`.claude/skills/look-it-up/SKILL.md: the saying-it phrases no longer map ${need} to plain words (KNW-002)`);
    }
    // Design 2: a claim assembled from several rows keeps the strength of its weakest.
    if (!/said at the strength of the weakest/i.test(text.replace(/\s+/g, ' '))) faults.push('.claude/skills/look-it-up/SKILL.md: no longer says an answer drawn from several rows is said at the strength of the weakest (KNW-002)');
  }
}

// KNW-001 design 2: where her words touch a subject only loosely, the evidence
// skill breaks toward silence, so the base never becomes an agenda. The skill must
// say an unclear match counts as no match, and that nothing runs unless she asked.
{
  const skill = join(REPO, '.claude', 'skills', 'look-it-up', 'SKILL.md');
  if (existsSync(skill)) {
    const text = readFileSync(skill, 'utf8').replace(/\s+/g, ' ');
    if (!/unclear match counts as no match/i.test(text)) {
      faults.push('.claude/skills/look-it-up/SKILL.md: no line saying an unclear match counts as no match, so a loose match can raise a subject she did not bring (KNW-001)');
    }
    if (!/if she didn't ask, nothing here runs/i.test(text)) {
      faults.push('.claude/skills/look-it-up/SKILL.md: no longer says nothing runs unless she asked (KNW-001)');
    }
  }
}

// KNW-003 design 1: a subject whose evidence can harm is handled by why she is
// asking, not by what it is about. The evidence skill must keep the question
// before the answer, the subjects that can harm, and the line that the reason
// decides the answer. (Design 2, the hand-over to the crisis section, is a
// safety behaviour and is not touched here.)
{
  const skill = join(REPO, '.claude', 'skills', 'look-it-up', 'SKILL.md');
  if (existsSync(skill)) {
    const text = readFileSync(skill, 'utf8').replace(/\s+/g, ' ');
    if (!/if the subject can harm, ask why she's asking first/i.test(text)) {
      faults.push(".claude/skills/look-it-up/SKILL.md: no longer asks why she is asking before evidence on a subject that can harm (KNW-003)");
    }
    for (const subject of ['weight', 'calories', 'tracking', 'sleep scores', 'self-harm']) {
      if (!text.toLowerCase().includes(subject)) faults.push(`.claude/skills/look-it-up/SKILL.md: the subjects that can harm no longer name ${subject} (KNW-003)`);
    }
    if (!/the reason decides the answer, not the topic/i.test(text)) {
      faults.push('.claude/skills/look-it-up/SKILL.md: no longer says the reason, not the topic, decides the answer (KNW-003)');
    }
  }
}

// KNW-004 design 1: a subject folder is made when a session needed that evidence
// and found none, never in advance. So every subject folder under a module's
// knowledge/ holds a practices.md with at least one claim row (an empty folder is
// a to-do list), and each core subject is listed on the index's Subjects line
// (a new folder joins the list in the same change).
{
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const coreDir = join(REPO, 'modules', 'core', 'knowledge');
  const index = existsSync(join(coreDir, 'README.md')) ? readFileSync(join(coreDir, 'README.md'), 'utf8') : '';
  const listed = index.match(/\*\*Subjects:\*\*([^\n]*)/)?.[1] ?? '';
  let modules = [];
  try { modules = readdirSync(join(REPO, 'modules')); } catch { /* No modules folder: nothing to check. */ }
  for (const mod of modules) {
    const dir = join(REPO, 'modules', mod, 'knowledge');
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const sub = join(dir, name);
      if (name.startsWith('_') || !statSync(sub).isDirectory()) continue;
      const rel = relative(REPO, sub).replace(/\\/g, '/');
      const file = join(sub, 'practices.md');
      let rows = 0;
      if (existsSync(file)) {
        const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (!/^\|\s*Practice\s*\|/.test(lines[i])) continue;
          for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
            if (cells(lines[j]).some((c) => c)) rows++;
          }
        }
      }
      if (!rows) faults.push(`${rel}/: a subject folder with no claim in a practices.md was made in anticipation, not because a session needed it (KNW-004)`);
      if (mod === 'core' && !listed.includes(name)) faults.push(`${rel}/: not on the Subjects line of modules/core/knowledge/README.md (KNW-004)`);
    }
  }
}

// MEM-010 design 1: a pattern entry carries the date she named it and the date
// of its latest instance, so a reader sees how old a loop is before treating it
// as current. The pattern template must hold both lines.
{
  const file = join(REPO, 'modules', 'core', 'templates', 'pattern-work', 'pattern.md');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  for (const label of ['Named on', 'Last true']) {
    if (existsSync(file) && !new RegExp(`^\\*\\*${label}:\\*\\*`, 'm').test(text)) {
      faults.push(`modules/core/templates/pattern-work/pattern.md: no "${label}" line, so a pattern cannot show how old it is (MEM-010)`);
    }
  }
}

// MEM-010 design 3: where exceptions pile up under a pattern, the pattern-work
// skill has the agent ask her once whether it still fits, and on a no archive
// it, never delete it. The skill must say so and cite the row.
{
  const file = join(REPO, '.claude', 'skills', 'pattern-work', 'SKILL.md');
  if (existsSync(file)) {
    const text = readFileSync(file, 'utf8');
    if (!/MEM-010/.test(text) || !/exceptions? (pile|accumulat)/i.test(text) || !/data\/archive\//.test(text)) {
      faults.push('.claude/skills/pattern-work/SKILL.md: does not say to ask her once whether a pattern still fits when exceptions pile up, and to archive it to data/archive/ on a no (MEM-010)');
    }
  }
}

// MEM-012 design 1: a standing fact carries the date it was last known true, so
// a reader weighs it by its age. The person template must hold that line.
{
  const file = join(REPO, 'modules', 'core', 'templates', 'a-person', 'person.md');
  if (existsSync(file) && !/^\*\*Last confirmed:\*\*/m.test(readFileSync(file, 'utf8'))) {
    faults.push('modules/core/templates/a-person/person.md: no "Last confirmed" line, so a standing fact cannot show how long it has stood (MEM-012)');
  }
}

// MEM-013 design 2: a gap in a person's file is written as "not yet known", not
// closed by asking her. The person template must show the line.
{
  const file = join(REPO, 'modules', 'core', 'templates', 'a-person', 'person.md');
  if (existsSync(file) && !/^\*\*Not yet known:\*\*/m.test(readFileSync(file, 'utf8'))) {
    faults.push('modules/core/templates/a-person/person.md: no "Not yet known" line, so a gap is asked about instead of marked (MEM-013)');
  }
}

// MEM-012 design 2: where a fact is old and the reply leans on it, the a-person
// skill has the agent ask about her life in a way that would show a change,
// never ask her to review the record, and re-date a fact she restates.
{
  const file = join(REPO, '.claude', 'skills', 'a-person', 'SKILL.md');
  if (existsSync(file)) {
    const text = readFileSync(file, 'utf8');
    if (!/MEM-012/.test(text) || !/Last confirmed/.test(text) || !/never (?:ask|asks) her to review/i.test(text)) {
      faults.push('.claude/skills/a-person/SKILL.md: does not say to re-date "Last confirmed" when she restates a fact, or to check an old fact by asking about her life, never by asking her to review the record (MEM-012)');
    }
  }
}

// MEM-013 design 1: a gap that matters now is asked as one question folded into
// the reply, never a list, and a gap is otherwise marked "Not yet known".
{
  const file = join(REPO, '.claude', 'skills', 'a-person', 'SKILL.md');
  if (existsSync(file)) {
    const text = readFileSync(file, 'utf8');
    if (!/MEM-013/.test(text) || !/Not yet known/.test(text) || !/one question/i.test(text) || !/never a list/i.test(text)) {
      faults.push('.claude/skills/a-person/SKILL.md: does not say to ask one question, never a list, about a gap only when the conversation needs it, and to mark other gaps "Not yet known" (MEM-013)');
    }
  }
}

// FIT-001 design 1: the narrow-or-wide rule sits in CLAUDE.md under "Every
// reply" so every skill inherits it: ask once per chat, narrow until she
// answers, a switch line after each list or table, never in a safety reply.
{
  const file = join(REPO, 'CLAUDE.md');
  if (existsSync(file)) {
    const text = readFileSync(file, 'utf8');
    const at = text.indexOf('### Every reply');
    const block = at < 0 ? '' : text.slice(at, at + 3000);
    const parts = [/FIT-001/, /narrow \(mobile\) or wide \(desktop\)/, /ask(?:ed)? once/i, /Until she answers,\s+show narrow/i, /for that chat only/i, /how to switch/i, /Never in a reply about her safety/i];
    if (parts.some((re) => !re.test(block))) {
      faults.push('CLAUDE.md: the "Every reply" section no longer holds the whole narrow-or-wide rule (ask once, narrow until she answers, kept per chat, a switch line, never in a safety reply) (FIT-001)');
    }
  }
}

// MEM-005 designs 1 and 2: recording happens as it surfaces, with no step from
// her. CLAUDE.md keeps the routing and says to record unasked (design 1), and a
// Stop hook saves whatever was written, so she never saves or approves (design 2).
{
  const file = join(REPO, 'CLAUDE.md');
  if (existsSync(file)) {
    const text = readFileSync(file, 'utf8').replace(/\s+/g, ' ');
    if (!/Record as it surfaces/i.test(text) || !/never wait to be asked, never ask permission/i.test(text) || !/## Memory Management/.test(text)) {
      faults.push('CLAUDE.md: the Memory Management section no longer says to record as it surfaces, never waiting to be asked and never asking permission (MEM-005)');
    }
  }
  const settings = join(REPO, '.claude', 'settings.json');
  if (existsSync(settings)) {
    const stop = JSON.stringify(JSON.parse(readFileSync(settings, 'utf8')).hooks?.Stop ?? []);
    if (!stop.includes('record/save-record.mjs')) {
      faults.push('.claude/settings.json: no Stop hook runs record/save-record.mjs, so a written record is not saved when the turn ends (MEM-005)');
    }
  }
}

// PMM-004 designs 1 and 2: a route in the router tables (CLAUDE.md's, and the
// modules' in .claude/modules.md) carries the rule that must hold even if its
// skill never loads. So a route must still name a procedure that exists, or
// retiring or renaming one leaves a rule pointing at nothing without anyone
// deciding where that rule now lives; and its must-hold cell must not be empty.
{
  const known = new Set(
    skills.map((f) => {
      const name = basename(dirname(f));
      const mod = relative(join(REPO, 'modules'), f).split(/[\\/]/);
      return f.startsWith(join(REPO, 'modules')) ? `${mod[0]}:${name}` : name;
    }),
  );
  const tables = [
    ['CLAUDE.md', (t) => t.split(/^### Everything else is a skill\s*$/m)[1]?.split(/^#{2,3} /m)[0] ?? ''],
    ['.claude/modules.md', (t) => t],
  ];
  for (const [rel, section] of tables) {
    const file = join(REPO, ...rel.split('/'));
    if (!existsSync(file)) continue;
    for (const line of section(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).split('\n')) {
      if (!line.startsWith('|')) continue;
      const cells = line.replace(/\\\|/g, '\u0000').split('|').slice(1, -1).map((c) => c.replace(/\u0000/g, '|').trim());
      if (cells.length < 3) continue;
      const named = /^`([\w:-]+)`$/.exec(cells[1])?.[1] ?? /^\*\*([\w:-]+)\*\*$/.exec(cells[1])?.[1];
      if (!named || named === 'none') continue;
      if (!known.has(named)) faults.push(`${rel}: the route for "${cells[0]}" names ${named}, which is not a procedure on file; move its must-hold rule before retiring or renaming it (PMM-004)`);
      else if (!cells[2]) faults.push(`${rel}: the route to ${named} has an empty must-hold cell, so nothing holds if it never loads (PMM-004)`);
    }
  }
}

// PRL-002 design 1: a retired procedure moves whole to an archive, a folder
// renamed with a leading underscore, so it can be brought back as it was. An
// archive folder holding no SKILL.md is a procedure that lost its files.
{
  const archives = (dir) => {
    let names;
    try { names = readdirSync(dir); } catch { return []; }
    return names.flatMap((name) => {
      const path = join(dir, name);
      if (name === 'node_modules' || !statSync(path).isDirectory()) return [];
      return name.startsWith('_') ? [path] : archives(path);
    });
  };
  for (const dir of [join(REPO, '.claude', 'skills'), join(REPO, 'modules')].flatMap(archives)) {
    if (!existsSync(join(dir, 'SKILL.md'))) faults.push(`${relative(REPO, dir).replace(/\\/g, '/')}/: an archived procedure with no SKILL.md is not whole, so it cannot be brought back as it was (PRL-002)`);
  }
}

// DEP-014 design 3: the set-up skill learns from every run, so it also has a size
// limit, or it grows without end: lines for the folder, and words for SKILL.md's
// body and each file beside it, so what one run reads stays short (T-598).
// Over it, split by situation or consolidate before adding. Tested by
// ux/scripts/test-setup-size.mjs.
{
  const { threshold } = await import(pathToFileURL(join(REPO, '.claude', 'hooks', 'lib', 'thresholds.mjs')).href);
  const { setUpSizeFaults } = await import(pathToFileURL(join(REPO, 'ux', 'lib', 'setup-size.mjs')).href);
  faults.push(
    ...setUpSizeFaults(join(REPO, '.claude', 'skills', 'set-up'), {
      mainLines: threshold('setUp.mainLines', 'lines'),
      fileLines: threshold('setUp.fileLines', 'lines'),
      folderLines: threshold('setUp.folderLines', 'lines'),
      mainWords: threshold('setUp.mainWords', 'words'),
      fileWords: threshold('setUp.fileWords', 'words'),
      routeWords: threshold('setUp.routeWords', 'words'),
    }),
  );
}

// PMM-015 design 2, the owner's word limit for every skill (A-074, T-600): the
// body, each part SKILL.md links to, and one run. A skill over it today is listed
// in .claude/skills/size-baseline.json and may only shrink. Tested by
// ux/scripts/test-skill-size.mjs.
{
  const { threshold } = await import(pathToFileURL(join(REPO, '.claude', 'hooks', 'lib', 'thresholds.mjs')).href);
  const { skillSizeFaults } = await import(pathToFileURL(join(REPO, 'ux', 'lib', 'skill-size.mjs')).href);
  faults.push(
    ...skillSizeFaults(REPO, {
      mainWords: threshold('skills.mainWords', 'words'),
      partWords: threshold('skills.partWords', 'words'),
      runWords: threshold('skills.runWords', 'words'),
    }),
  );
}

// T-330 group A edge cases: the skills for her own conversations yield to the
// crisis block in CLAUDE.md, hedged and passive forms and being unsure included
// (a narrower list let a passive phrase carry on), and the ones that write what
// she says keep the off-the-record exception (MEM-016), which "log it as it
// surfaces" otherwise overrode. Cases in dev/skills/<name>/cases.md.
{
  const read = (name) => {
    const file = join(REPO, '.claude', 'skills', name, 'SKILL.md');
    return existsSync(file) ? readFileSync(file, 'utf8').replace(/\s+/g, ' ') : null;
  };
  for (const name of ['something-happened', 'a-person', 'journal', 'pattern-work']) {
    const text = read(name);
    if (text === null) continue;
    if (!/hedged or passive ones included, or you're unsure → stop\. (Go to c|C)risis handling in `CLAUDE\.md`/.test(text)) {
      faults.push(`.claude/skills/${name}/SKILL.md: no longer yields to the crisis block in CLAUDE.md for hedged or passive forms and when unsure (T-330 group A)`);
    }
  }
  for (const name of ['something-happened', 'a-person', 'journal']) {
    const text = read(name);
    if (text !== null && !/someone else's confidence/i.test(text)) {
      faults.push(`.claude/skills/${name}/SKILL.md: no longer keeps the off-the-record exception, "between us" or someone else's confidence (MEM-016, T-330 group A)`);
    }
  }
  const first = read('first-contact');
  if (first !== null && !/People I can reach/.test(first)) {
    faults.push('.claude/skills/first-contact/SKILL.md: the bad-night person no longer goes to the safety plan (T-330 group A, FC-3)');
  }
}

if (faults.length) {
  console.error(['', '  SKILL HEADER CHECK FAILED', '', ...faults.map((f) => `  - ${f}`), '',
    '  An unquoted description with ": " in it ends early. Use a comma or a', '  semicolon there, or quote the whole value.', ''].join('\n'));
  process.exit(1);
}
console.log(`skill header check: ${skills.length} skills and ${commands.length} commands parse, each described`);
