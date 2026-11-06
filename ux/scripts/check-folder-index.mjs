// FND-002: every folder this project designed has a README.md indexing the folders inside it.
//
//   node scripts/check-folder-index.mjs     (runs as part of `npm run check`)
//
// Only project-designed folders need indexing: everything under the roots in
// DESIGNED. A folder laid out by a tool's convention (.claude/'s commands, hooks and
// skills, ux/'s app tree) is common knowledge, and an index there only restates
// the tool's docs. For every folder that holds a project-designed folder, two rules:
//
//   README   the folder has a `README.md`, spelled exactly so. Not `INDEX.md`,
//            not `readme.md`: one name, so a reader never has to guess which
//            file is the map.
//   INDEX    that README names each project-designed folder directly inside it as `name/` —
//            a link, a code span or a tree line all count. Only the next level
//            down: each of those folders indexes its own.
//
// "The repository" is what git tracks or would track: ignored folders
// (node_modules, temp, build output, hook state) are not part of it. One
// exemption, for the reason the row states: `<record>/archive/<bundle>/`, an
// archived bundle kept verbatim; the archive's own README indexes the bundles.
//
// Two more rules ride along: the root README names CLAUDE.md (ARC-003), and each archive keeps a README (ARC-010).
//
// Prints folder paths only to this terminal, never into a file.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_DIR, SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');

// The evidence base lives in modules/<module>/knowledge/, under modules.
const DESIGNED = ['data', 'data-sample', DEV_DIR, SPECS_DIR, 'modules', 'policies', '.claude/memory', '.claude/jobs'];
const designed = (path) => DESIGNED.some((root) => path === root || path.startsWith(`${root}/`));

const EXEMPT = [/^(data|data-sample|data-sandbox)\/archive\/[^/]+\//];

const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\0')
  .filter((f) => f && existsSync(join(repoRoot, f)));

// Every folder that holds a file, and every folder above it, keyed '' for the root.
const children = new Map([['', new Set()]]);
for (const file of listed) {
  const parts = file.split('/').slice(0, -1);
  for (let i = 0; i < parts.length; i++) {
    const parent = parts.slice(0, i).map((p) => `${p}/`).join('');
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent).add(parts[i]);
  }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const findings = [];
let indexed = 0;
for (const [dir, kids] of [...children].sort(([a], [b]) => a.localeCompare(b))) {
  const owed = [...kids].filter((k) => designed(`${dir}${k}`));
  if (!owed.length || EXEMPT.some((re) => re.test(dir))) continue;
  const where = dir || './';
  if (!readdirSync(join(repoRoot, dir)).includes('README.md')) {
    findings.push(`${where} has folders and no README.md indexing them`);
    continue;
  }
  const text = readFileSync(join(repoRoot, dir, 'README.md'), 'utf8');
  const missing = owed.filter((k) => !new RegExp(`(^|[^\\w.-])${escape(k)}/`, 'm').test(text)).sort();
  if (missing.length) findings.push(`${where}README.md does not index ${missing.map((k) => `${k}/`).join(', ')}`);
  else indexed++;
}

// ARC-003 design 2: the root README points at the instruction file instead of repeating it.
const rootReadme = join(repoRoot, 'README.md');
if (!existsSync(rootReadme)) findings.push('./ has no README.md for a reader who knows nothing (ARC-003)');
else if (!/CLAUDE\.md/.test(readFileSync(rootReadme, 'utf8'))) findings.push('./README.md does not point at CLAUDE.md (ARC-003)');

// ARC-003: the orientation stays true. The layout tree in the root README must
// name only paths that exist (a stale line is worse than none), and must name
// every folder the repository holds at its root.
// A new copy has never had two of the folders the tree names: dev/, removed from a
// copy made for someone else (DEP-013), and data-sandbox/, made on demand. Absent
// with nothing of them ever tracked, they are not stale lines; in the developer's
// tree both are tracked, so a removal there is still found (set-up cases,
// rehearsal 2026-10-27: step 6's `npm run check` failed on every new copy).
const neverHere = (path) => {
  const top = path.replace(/\/.*$/, '');
  // .github/ and .claude/commands/ are the developer's too: a release never carries them.
  const held = [DEV_DIR, 'data-sandbox', '.github', '.claude/commands'].find((w) => path === w || path === `${w}/` || path.startsWith(`${w}/`) || top === w);
  if (!held) return false;
  return !execFileSync('git', ['ls-files', '--', held], { cwd: repoRoot, encoding: 'utf8' }).trim();
};
if (existsSync(rootReadme)) {
  const block = (readFileSync(rootReadme, 'utf8').match(/## If you are reading the code[\s\S]*?```\n([\s\S]*?)```/) || [])[1];
  if (block === undefined) findings.push('./README.md has no layout tree under "If you are reading the code" (ARC-003)');
  else {
    const named = new Set();
    let top = '';
    for (const line of block.split('\n')) {
      const m = /^( {0,2})(\S+)(?=\s{2,}|\s*$)/.exec(line);
      if (!m) continue;
      const path = m[1] ? `${top}${m[2]}` : m[2];
      if (!m[1]) top = m[2].endsWith('/') ? m[2] : '';
      if (!existsSync(join(repoRoot, path)) && !neverHere(path)) findings.push(`./README.md layout names ${path}, which does not exist (ARC-003)`);
      if (!m[1]) named.add(m[2].replace(/\/.*$/, ''));
    }
    const unnamed = [...(children.get('') ?? [])].filter((k) => !named.has(k)).sort();
    if (unnamed.length) findings.push(`./README.md layout does not name ${unnamed.map((k) => `${k}/`).join(', ')} (ARC-003)`);
  }
}

// ARC-010 design 3: the archive folder exists before anything is archived, held by a README.
// data/ is absent where her record is (CI), so its archive is read only when the record is there.
for (const archive of ['data-sample/archive', ...(existsSync(join(repoRoot, 'data', 'PROFILE.yaml')) ? ['data/archive'] : [])]) {
  if (!existsSync(join(repoRoot, archive, 'README.md'))) findings.push(`${archive}/ has no README.md, so git may not track the folder (ARC-010)`);
}

// FND-005 design 5: every subject folder of the knowledge base is on its one subject list.
const knowledgeReadme = join(repoRoot, 'modules/core/knowledge/README.md');
if (existsSync(knowledgeReadme)) {
  const list = (readFileSync(knowledgeReadme, 'utf8').match(/\*\*Subjects:\*\*([\s\S]*?)(\n\s*\n|$)/) || [])[1];
  if (list === undefined) findings.push('modules/core/knowledge/README.md has no **Subjects:** list (FND-005)');
  else {
    const kdir = join(repoRoot, 'modules/core/knowledge');
    const folders = readdirSync(kdir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    const off = folders.filter((k) => !new RegExp(`(^|[^\\w.-])${escape(k)}(?![\\w-])`).test(list)).sort();
    if (off.length) findings.push(`modules/core/knowledge/ has subject folders not on the **Subjects:** list: ${off.join(', ')} (FND-005)`);
  }
}

if (findings.length) {
  console.error(
    `\n  FOLDER INDEX CHECK FAILED\n\n${findings.map((f) => `  - ${f}`).join('\n')}\n\n` +
      '  Add each folder to its parent README.md as `name/` with one line on what it holds.\n' +
      '  See FND-002 in dev/specs/system/findability.md.\n',
  );
  process.exit(1);
}

console.log(`folder index check: ${indexed} project-designed folders, each README.md indexing every folder inside it`);
