#!/usr/bin/env node
// Inline the see-it skill's logos into a page, so the published artifact loads
// nothing at view time (DEV-004 design 4). Runs the logo check first: a logo
// that fails it is never inlined. Each %%LOGO_<name>%% becomes a data URI of
// ../logos/<name>.svg; a name with no file, or a token left over, fails loudly.
// Dependency-free.
//
//   node .claude/skills/see-it/scripts/build.mjs <page.html> <out.html>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLogos, LOG } from './check-logos.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const logos = join(here, '..', 'logos');

/** The page with every logo token inlined; throws on a missing logo or a stray token. */
export function inline(page, dir = logos) {
  const missing = new Set();
  const out = page.replace(/%%LOGO_([\w-]+)%%/g, (_, name) => {
    const file = join(dir, `${name}.svg`);
    if (!existsSync(file)) {
      missing.add(name);
      return '';
    }
    return `data:image/svg+xml;base64,${readFileSync(file).toString('base64')}`;
  });
  if (missing.size) throw new Error(`no logo for: ${[...missing].join(', ')} (add it to logos/ with a SOURCES.md row, or use a generic glyph)`);
  const left = out.match(/%%[A-Z_]+[^%]*%%/);
  if (left) throw new Error(`token left unfilled: ${left[0]}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [src, dest] = process.argv.slice(2);
  if (!src || !dest) {
    console.error('usage: node .claude/skills/see-it/scripts/build.mjs <page.html> <out.html>');
    process.exit(2);
  }
  const { failures } = checkLogos(logos, LOG, new Date().toISOString().slice(0, 10));
  if (failures.length) {
    console.error(`logo check failed, nothing built:\n  - ${failures.join('\n  - ')}`);
    process.exit(1);
  }
  try {
    writeFileSync(dest, inline(readFileSync(src, 'utf8')));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  console.log(`built ${dest}`);
}
