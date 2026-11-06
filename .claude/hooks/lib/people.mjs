// Who has a file in people/, and where it is.
//
// MEM-001 design 1: one file per person, so she never re-explains who someone
// is. Tested in .claude/hooks/selftest.mjs.
//
// A person is EITHER `people/<name>.md` — one page, for most people — OR
// `people/<name>/`, a folder whose `README.md` is the front page, once there is
// more on them than one page holds (FND-004). Never both: two front pages for
// one person are two ledgers, and a session opening one never learns the other
// exists.
//
// One reader for every consumer — the dashboard, the privacy checks, the commit
// hook — so a person in folder form can never be listed by one and missed by
// another. A missed name in the privacy checks is a leak nobody sees.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every person in `peopleDir`, sorted by slug: `{ slug, file }`, with `file`
 * relative to `peopleDir` (`person-s.md` or `person-s/README.md`). A person with both a
 * page and a folder is listed once, by the page, and reported in `both`.
 */
export function readPeople(peopleDir) {
  let entries;
  try {
    entries = readdirSync(peopleDir, { withFileTypes: true });
  } catch {
    return { people: [], both: [] };
  }
  const pages = new Set();
  const folders = new Set();
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md') pages.add(e.name.slice(0, -3));
    else if (e.isDirectory() && existsSync(join(peopleDir, e.name, 'README.md'))) folders.add(e.name);
  }
  const slugs = [...new Set([...pages, ...folders])].sort();
  return {
    people: slugs.map((slug) => ({ slug, file: pages.has(slug) ? `${slug}.md` : `${slug}/README.md` })),
    both: slugs.filter((slug) => pages.has(slug) && folders.has(slug)),
  };
}

/** Just the slugs — the first names a leak would look like. */
export const peopleSlugs = (peopleDir) => readPeople(peopleDir).people.map((p) => p.slug);
