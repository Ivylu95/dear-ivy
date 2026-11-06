// The idea list (A-125, WKB-017): every idea from a dev chat, kept until the
// developer builds, parks or drops it, and put back to him once a month.
//
//   node ux/scripts/ideas.mjs check    every line in format, from a remark the Transcript holds,
//                                      left open unless a remark he typed says otherwise; exit 1 if not
//   node ux/scripts/ideas.mjs open     the open ideas, and whether this month's showing is due
//   node ux/scripts/ideas.mjs shown    record that the open ones were put back to him today
//
// The same check runs in the commit gate, inside ux/scripts/check-for-you.mjs.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
process.env.CLAUDE_PROJECT_DIR ||= repoRoot;
const { IDEAS, checkIdeas, openIdeas, putBackDue } = await import(pathToFileURL(join(repoRoot, '.claude', 'hooks', 'lib', 'ideas.mjs')).href);

const cmd = process.argv[2] ?? 'check';
const list = checkIdeas(repoRoot);
if (cmd === 'check') {
  for (const w of list.warnings) console.warn(`  ideas: ${w}`);
  if (list.problems.length) {
    console.error(`ideas: ${list.problems.length} problem(s) in the idea list (A-125):\n${list.problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`ideas: ${list.ideas.length} kept, ${openIdeas(list.ideas).length} open, put back ${list.putBack || 'never'}`);
} else if (cmd === 'open') {
  const open = openIdeas(list.ideas);
  console.log(`ideas: ${open.length} open; this month's showing ${putBackDue(list) ? 'is due' : 'is not due'} (put back ${list.putBack || 'never'})`);
  for (const i of open) console.log(`  - ${i.what} · ${i.whose} · found: ${i.found} (${i.from}, ${i.opened})`);
} else if (cmd === 'shown') {
  const today = new Date().toISOString().slice(0, 10);
  const text = readFileSync(IDEAS, 'utf8');
  if (!/^Put back: .*$/m.test(text)) {
    console.error('ideas: the list has no "Put back:" line to update');
    process.exit(1);
  }
  writeFileSync(IDEAS, text.replace(/^Put back: .*$/m, `Put back: ${today}`));
  console.log(`ideas: put back ${today}; commit ${IDEAS.slice(repoRoot.length + 1).replace(/\\/g, '/')}`);
} else {
  console.error('usage: node ux/scripts/ideas.mjs check | open | shown');
  process.exit(2);
}
