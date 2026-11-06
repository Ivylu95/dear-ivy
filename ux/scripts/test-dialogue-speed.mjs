// Rule test (T-822): the generated pages are made fast, and exactly as before. A merge hands
// some 45 generated pages to the driver, each rebuilt from the whole Transcript; each took
// about 14 seconds, so a merge took about 8 minutes and other chats' pushes raced it.
// Each page line is now kept once made, and a merge works out its Transcript once.
//
// Run: node ux/scripts/test-dialogue-speed.mjs

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIALOGUE_DIR, readTranscript, renderIndex } from './dialogue.mjs';

// A copy without dev/ (ARC-008) has no Transcript to read or pages to make.
if (!existsSync(join(DIALOGUE_DIR, 'transcript'))) {
  console.log('dialogue speed: no dev/dialogue/ in this copy (ARC-008), nothing to time');
  process.exit(0);
}

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const entries = readTranscript();
const t0 = Date.now();
const first = renderIndex(entries);
const firstMs = Date.now() - t0;
check(`the pages by way and topic are made in under 3 seconds (took ${firstMs} ms; 14 s before T-822)`, firstMs < 3000);
// Fresh remarks, nothing kept: the same text as pages made from kept lines.
const again = renderIndex(entries);
const fresh = renderIndex(readTranscript().map((e) => ({ ...e })));
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
check('pages made twice are the same, page for page', same(first, again));
check('pages from kept lines match pages made from scratch', same(first, fresh));
check('the whole Transcript is read and every page is made', entries.length > 700 && Object.keys(first).length >= 30);

console.log(failed ? `dialogue speed: ${failed} failed` : 'dialogue speed: all cases hold');
process.exit(failed ? 1 : 0);
