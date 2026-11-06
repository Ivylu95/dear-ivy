// FND-004: the record's fixed names, checked, not just written down.
//
//   node scripts/check-record-names.mjs     (runs as part of `npm run check`)
//
// Four rules, on her record, the sandbox and the sample alike:
//
//   ROOT     `README.md` and `PROFILE.yaml`, spelled exactly so. README.md is the
//            folder map and the standing-files index in one file, so there is no
//            `INDEX.md` beside it; the profile is in capitals, so there is no
//            `profile.yaml`. The listing is read case-exactly: Windows would
//            open `profile.yaml` as `PROFILE.yaml`, and a Linux machine would not.
//   MOVED    None of core's files at the root: they live under `core/` (ARC-006),
//            and one back at the root is a session writing to the old path.
//   PEOPLE   A person is `people/<name>.md` or `people/<name>/` fronted by its
//            `README.md`, never both. Both at once are two front pages, and a
//            session opening one never learns the other exists.
//
//   ARCHIVE  Nothing under an `archive/` carries a name git or the agent reads as
//            configuration (ARC-011): `.claude`, `.gitignore`, `CLAUDE.md` and the
//            like are renamed with a leading underscore as they enter, so an
//            archived harness never wakes up as this repository's own.
//   DATED    A journal entry is `YYYY-MM-DD.md` (FND-004), and the files in
//            `me/` are snake_case, so a listing tells each file's kind.
//
// Prints a person's slug only to this terminal, never into a file.

import { existsSync, readdirSync } from 'node:fs';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPeople } from '../../.claude/hooks/lib/people.mjs';
import { CORE_DATA } from '../../.claude/hooks/lib/modules.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');

const REQUIRED = ['README.md', 'PROFILE.yaml'];
const RETIRED = {
  'INDEX.md': 'merge it into README.md under Standing files',
  'profile.yaml': 'rename it PROFILE.yaml',
  // core's files moved under core/ (ARC-006). One of these back at the root is
  // a session still writing to the old path: a second copy the record forks on.
  ...Object.fromEntries(
    ['timeline.md', 'state', 'me', 'people', 'calendar', 'journal', 'assets'].map((p) => [p, `it belongs under ${CORE_DATA}/; merge it into ${CORE_DATA}/${p}`]),
  ),
};

// Names git or the agent's tooling read as configuration (ARC-011).
const WORKING_NAMES = new Set([
  '.claude', '.git', '.gitignore', '.gitattributes', '.gitmodules', '.mcp.json', '.cursorrules',
  'CLAUDE.md', 'AGENTS.md',
]);
// ARCHIVE and DATED run on the sandbox and the sample only. Her live record already
// holds names that break them (an archived harness's CLAUDE.md, a month file in
// the journal), and mending those moves her files, which no unattended run does;
// a session that moves them adds `data` here.
const DATED = /^\d{4}-\d{2}-\d{2}\.md$/;
const SNAKE = /^[a-z0-9]+(_[a-z0-9]+)*\.(md|yaml)$/;
const STRICT = new Set(['data-sandbox', 'data-sample']);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return [full, ...(statSync(full).isDirectory() && name !== '.git' ? walk(full) : [])];
  });

const findings = [];
let people = 0;
for (const record of ['data', 'data-sandbox', 'data-sample']) {
  const dir = join(repoRoot, record);
  if (!existsSync(dir)) continue;
  const names = readdirSync(dir);
  for (const name of REQUIRED) if (!names.includes(name)) findings.push(`${record}/ has no ${name}`);
  for (const [name, fix] of Object.entries(RETIRED)) if (names.includes(name)) findings.push(`${record}/${name}: ${fix}`);

  const archive = join(dir, 'archive');
  if (STRICT.has(record) && existsSync(archive))
    for (const path of walk(archive)) {
      const rel = path.slice(archive.length + 1);
      if (WORKING_NAMES.has(rel.split('/').pop())) findings.push(`${record}/archive/${rel}: a working name in the archive; rename it with a leading underscore (ARC-011)`);
    }

  const journal = join(dir, CORE_DATA, 'journal');
  if (STRICT.has(record) && existsSync(journal))
    for (const name of readdirSync(journal)) if (name !== 'README.md' && !DATED.test(name)) findings.push(`${record}/${CORE_DATA}/journal/${name}: a dated entry is YYYY-MM-DD.md (FND-004)`);
  const me = join(dir, CORE_DATA, 'me');
  if (STRICT.has(record) && existsSync(me))
    for (const name of readdirSync(me)) if (name !== 'README.md' && !SNAKE.test(name)) findings.push(`${record}/${CORE_DATA}/me/${name}: a record file is snake_case (FND-004)`);

  const found = readPeople(join(dir, CORE_DATA, 'people'));
  people += found.people.length;
  for (const slug of found.both) findings.push(`${record}/people/ has both ${slug}.md and ${slug}/: move the page into the folder as its README.md`);
}

if (findings.length) {
  console.error(
    `\n  RECORD NAMES CHECK FAILED\n\n${findings.map((f) => `  - ${f}`).join('\n')}\n\n` +
      '  See FND-004 in dev/specs/system/findability.md, and the naming table in ARCHITECTURE.md.\n',
  );
  process.exit(1);
}

console.log(`record names check: README.md and PROFILE.yaml at every root, ${people} people each a page or a folder`);
