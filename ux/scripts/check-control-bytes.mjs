// A source file must not carry a stray control byte.
//
// One did, unseen: ux/lib/markdown.js held a raw U+0001 where a regex meant the
// backreference `\1`, so the heading pattern never matched and no rendered
// heading anywhere got an anchor (found 2026-10-03). Editors draw nothing for
// it, diffs show nothing, lint parses it as a valid character inside a regex.
// Only a byte scan sees it.
//
// Tracked text files outside data/ (her record is hers; a byte there is not
// code). Tab, newline and carriage return are the only control bytes allowed.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXT = /\.(c?js|mjs|jsx|ts|tsx|css|md|json|ya?ml|sh|txt)$/i;
// Anything below 0x20 except \t \n \r, and DEL.
const STRAY = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

const files = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((path) => path && TEXT.test(path) && !path.startsWith('data/'));

const found = [];
for (const path of files) {
  let text;
  try {
    text = readFileSync(join(root, path), 'utf8');
  } catch {
    continue;
  }
  if (!STRAY.test(text)) continue;
  text.split('\n').forEach((line, i) => {
    const m = STRAY.exec(line);
    if (m) found.push(`  ${path}:${i + 1} · U+${m[0].charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}`);
  });
}

// DES-003: nothing the surface draws depends on a glyph the reader's font may
// lack. In the drawing code (the Workflow tab, the shared icon set and the
// shared stylesheets) an arrow, box-drawing, block or dingbat character outside
// a comment is drawn by a fallback font on some machines, so marks come from
// the icon set or the stylesheet instead. Comments are not drawn, and are skipped.
const DRAWN = /^(?:dev\/ui\/components\/workflow\/|dev\/ui\/app\/\(admin\)\/(?:@rail\/)?workflow\/|dev\/ui\/app\/admin-styles\/workflow\.css$|ux\/components\/ui\/|ux\/app\/styles\/)/;
const WIDE_GLYPH = /[\u2190-\u21FF\u2500-\u259F\u25A0-\u25FF\u2700-\u27BF\u2B00-\u2BFF]/;
const withoutComments = (text, path) => {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return path.endsWith('.css') ? noBlock : noBlock.replace(/^\s*\/\/.*$/gm, '').replace(/(\s)\/\/[^\n'"`]*$/gm, '$1');
};
for (const path of files.filter((p) => DRAWN.test(p) && /\.(?:c?js|mjs|jsx|css)$/.test(p))) {
  let text;
  try {
    text = readFileSync(join(root, path), 'utf8');
  } catch {
    continue;
  }
  withoutComments(text, path).split('\n').forEach((line, i) => {
    const m = WIDE_GLYPH.exec(line);
    if (m) found.push(`  ${path}:${i + 1} · U+${m[0].charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()} is drawn, not a comment (DES-003: draw marks from the icon set or the stylesheet)`);
  });
}

if (found.length) {
  console.error('CONTROL BYTE CHECK FAILED\n');
  console.error(found.join('\n'));
  console.error('\n  A control byte in source is almost always a mistyped escape (a backreference typed as U+0001).');
  console.error('  Retype it as the escape it was meant to be.');
  process.exit(1);
}
console.log(`control-byte check: ${files.length} tracked text files, none carries a stray control byte`);
