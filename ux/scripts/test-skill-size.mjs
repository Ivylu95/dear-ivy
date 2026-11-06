// Rule test for lib/skill-size.mjs, PMM-015 design 2's word limit on every
// skill (A-074, T-600): the body, each part SKILL.md links to, and one run, with
// the list of skills over it today that may only shrink. Small trees built in a
// temporary folder, and the shipped tree against the shipped thresholds.
//
// Run from the repository root: node ux/scripts/test-skill-size.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE, overs, partsOf, skillSizeFaults } from '../lib/skill-size.mjs';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const limits = { mainWords: 1000, partWords: 1500, runWords: 2500 };
const front = '---\nname: x\ndescription: ' + words(300) + '\n---\n';
const tree = (skills, baseline) => {
  const root = makeTemp('dear-skill-size-');
  for (const [dir, files] of Object.entries(skills)) {
    mkdirSync(join(root, dir), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, dir, name)), { recursive: true });
      writeFileSync(join(root, dir, name), body);
    }
  }
  if (baseline !== undefined) {
    mkdirSync(join(root, dirname(BASELINE)), { recursive: true });
    writeFileSync(join(root, BASELINE), typeof baseline === 'string' ? baseline : JSON.stringify({ over: baseline }));
  }
  return root;
};
const none = { head: null };

// Within every limit: nothing to say. The frontmatter is not the body.
{
  const root = tree({ '.claude/skills/a': { 'SKILL.md': front + words(985) + '\n\n**Every run reads:** `part.md`\n', 'part.md': words(1400) } });
  check('a skill within every limit passes, its frontmatter not counted', skillSizeFaults(root, limits, none).length === 0);
}

// Over the body limit, in each place a skill can live.
for (const dir of ['.claude/skills/a', 'dev/skills/a', 'modules/m/skills/a']) {
  const root = tree({ [dir]: { 'SKILL.md': front + words(1001) } });
  const f = skillSizeFaults(root, limits, none);
  check(`a body over 1,000 words is refused in ${dir.split('/')[0]}`, f.some((x) => x.includes(`${dir}/SKILL.md: 1001 words`)));
}

// A linked part over 1,500 is refused; an unlinked record beside it is not a part.
{
  const root = tree({ '.claude/skills/a': { 'SKILL.md': front + 'read [the part](part.md)', 'part.md': words(1501), 'log.md': words(5000) } });
  const f = skillSizeFaults(root, limits, none);
  check('a part SKILL.md links to, over 1,500 words, is refused', f.some((x) => x.includes('.claude/skills/a/part.md: 1501 words')));
  check('a file SKILL.md never names is a record, not a part', !f.some((x) => x.includes('log.md')) && partsOf(join(root, '.claude/skills/a')).join() === 'part.md');
}

// One run without the marker: the body and its largest part. Only set-up is
// measured so (its exact routes are setup-size.mjs's; every other skill with
// parts carries the marker, T-692). With both within their own limits a run is
// too (1,000 + 1,500), so the run limit bites on a skill over a limit today:
// listing its body does not excuse a run that reads past 2,500.
{
  const root = tree({ '.claude/skills/set-up': { 'SKILL.md': front + words(1198) + ' `big.md` `small.md`', 'big.md': words(1400), 'small.md': words(10) } }, { '.claude/skills/set-up/SKILL.md': 1200 });
  const f = skillSizeFaults(root, limits, none);
  check('one run over 2,500 words is refused, though its body is listed and its part within its own limit', f.length === 1 && f[0].includes('one run (.claude/skills/set-up') && f[0].includes('2600 words'));
}

// The list of skills over the limit today: held at its size, never grown.
{
  const skill = { '.claude/skills/a': { 'SKILL.md': front + words(1200) } };
  check('a listed skill at its listed size passes', skillSizeFaults(tree(skill, { '.claude/skills/a/SKILL.md': 1200 }), limits, none).length === 0);
  check('a listed skill smaller than listed passes', skillSizeFaults(tree(skill, { '.claude/skills/a/SKILL.md': 1300 }), limits, none).length === 0);
  const grown = skillSizeFaults(tree(skill, { '.claude/skills/a/SKILL.md': 1100 }), limits, none);
  check('a listed skill grown past its listed size is refused', grown.some((x) => x.includes('grown past its listed 1100')));
  const under = { '.claude/skills/a': { 'SKILL.md': front + words(900) } };
  check('a listed skill now within the limit must leave the list', skillSizeFaults(tree(under, { '.claude/skills/a/SKILL.md': 1200 }), limits, none).some((x) => x.includes('now within its limit')));
  check('a list that is not JSON is refused, never read as empty', skillSizeFaults(tree(skill, '{ nope'), limits, none).some((x) => x.includes('not valid JSON')));
}

// The list may only shrink against HEAD.
{
  const skill = { '.claude/skills/a': { 'SKILL.md': front + words(1200) } };
  const root = tree(skill, { '.claude/skills/a/SKILL.md': 1200 });
  check('a key added to the list since HEAD is refused', skillSizeFaults(root, limits, { head: {} }).some((x) => x.includes('was added to the list')));
  check('a value raised since HEAD is refused', skillSizeFaults(root, limits, { head: { '.claude/skills/a/SKILL.md': 1150 } }).some((x) => x.includes('raised from 1150 to 1200')));
  check('a value kept since HEAD passes', skillSizeFaults(root, limits, { head: { '.claude/skills/a/SKILL.md': 1200 } }).length === 0);
}

// A part outside the skill's folder is still a part: a shared file, a
// subfolder, linked by a relative path, resolved and counted once. The spec
// skills' shared rules sat outside every skill's folder and were never counted,
// so three routes ran past 2,500 words with the check green (A-074, T-607).
{
  const root = tree({
    'dev/skills/a': { 'SKILL.md': front + 'read [the core](../shared/core.md), then [the other](references/other.md), or [again](./../shared/core.md#top), never [hers](../../../data/x.md)', 'references/other.md': words(20) },
    'dev/skills/shared': { 'core.md': words(1501) },
    'data': { 'x.md': words(9000) },
  });
  const f = skillSizeFaults(root, limits, none);
  check('a linked file outside the skill folder is a part, counted against 1,500', f.some((x) => x.includes('dev/skills/shared/core.md: 1501 words')));
  check('a linked file in a subfolder is a part, and each part is counted once', partsOf(join(root, 'dev/skills/a')).join() === '../shared/core.md,references/other.md');
  check('a link into data/ is never read or counted', !f.some((x) => x.includes('data/')));
  const work = tree({
    'dev/skills/a': { 'SKILL.md': front + 'judge [the register](../../specs/big.md) against [the knowledge](../../../modules/m/knowledge/k.md)' },
    'dev/specs': { 'big.md': words(7000) },
    'modules/m/knowledge': { 'k.md': words(3000) },
  });
  check('a register or knowledge file the job works on is material, not a part', partsOf(join(work, 'dev/skills/a')).length === 0 && skillSizeFaults(work, limits, none).length === 0);
}

// A split skill states its routes: a **Every run reads:** line, and a routing
// table whose rows name the parts each situation reads. One run is then each
// row exactly: the body, every file the marker names, and every part the row
// names. Body and largest part would miss a row that reads two parts (T-607).
const table = (...rows) => '\n\n| Situation | Read |\n|---|---|\n' + rows.map(([a, b]) => `| ${a} | ${b} |`).join('\n') + '\n';
const marked = (body, rows, extra = '') => front + words(body) + '\n\n**Every run reads:** `../shared/core.md`\n' + extra + table(...rows);
{
  const root = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['Both', '[one](one.md), then [two](two.md)'], ['One', '`one.md`']]), 'one.md': words(800), 'two.md': words(800) },
    'dev/skills/shared': { 'core.md': words(600) },
  });
  const f = skillSizeFaults(root, limits, none);
  check(`a route is summed row by row: body, what every run reads, and every part its row names${f.length ? "" : ": nothing reported"}`, f.some((x) => x.includes('dev/skills/a') && x.includes('"Both"') && x.includes("2512 words")));
  check('a route within the limit is not reported', !f.some((x) => x.includes('"One"')));
}

// Every run reads only what the marker line names: the same words in prose are
// not a marker, so a file named in a sentence that happens to say "every run
// reads" is not added to every run.
{
  const root = tree({
    'dev/skills/a': { 'SKILL.md': front + words(900) + ' **Every run reads [the core](../shared/core.md) first.** Then [one](one.md).', 'one.md': words(900) },
    'dev/skills/shared': { 'core.md': words(900) },
  });
  const f = skillSizeFaults(root, limits, none);
  check('prose that says "every run reads" is not the marker: nothing is summed into every run, and the marker is still owed', f.length === 1 && f[0].includes('no **Every run reads:** line'));
}

// Material a run works on, never instructed by, is left out only by name.
{
  const material = '**Material, not counted:** `ledger.md` (its own table, looked up)\n';
  const root = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['One', '[one](one.md); records in `ledger.md`']], material), 'one.md': words(400), 'ledger.md': words(3000) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  check('a ledger named on the Material line is not a part', skillSizeFaults(root, limits, none).length === 0);
  const unnamed = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['One', '[one](one.md); records in `ledger.md`']]), 'one.md': words(400), 'ledger.md': words(3000) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  check('the same ledger, not named as material, is counted', skillSizeFaults(unnamed, limits, none).some((x) => x.includes('dev/skills/a/ledger.md: 3000 words')));
}

// A skill whose every run reads only its own page says so on the marker:
// "**Every run reads:** nothing beyond this page." names no file, and is still
// the marker, so each row is summed from the body alone (T-687).
{
  const empty = '**Every run reads:** nothing beyond this page.\n';
  const root = tree({
    'dev/skills/a': { 'SKILL.md': front + words(300) + '\n\n' + empty + table(['One', '[one](one.md)'], ['Both', '`one.md`, [two](two.md)']), 'one.md': words(1100), 'two.md': words(1100) },
  });
  const f = skillSizeFaults(root, limits, none);
  check('an empty Every run reads line is the marker: rows are summed from the body alone', f.length === 1 && f[0].includes('"Both"') && f[0].includes("2514 words"));
  const fits = tree({
    'dev/skills/a': { 'SKILL.md': front + words(300) + '\n\n' + empty + table(['One', '[one](one.md)'], ['Two', '[two](two.md)']), 'one.md': words(1100), 'two.md': words(1100) },
  });
  check('with each part on its own row, the same skill passes', skillSizeFaults(fits, limits, none).length === 0);
  const ledger = tree({
    'dev/skills/a': { 'SKILL.md': front + words(300) + '\n\n' + empty + '**Material, not counted:** `log.md`, written to, never read.\n', 'log.md': words(4000) },
  });
  check('an empty marker with only material beside it needs no routing table', skillSizeFaults(ledger, limits, none).length === 0);
}

// One level on: a part that tells the reader to read another skill file must
// have it in the same row.
{
  const root = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['One', '[one](one.md)'], ['Three', '[three](three.md)']]), 'one.md': words(100) + ' Read [three](three.md) before this.', 'three.md': words(100) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  const f = skillSizeFaults(root, limits, none);
  check('a part sending the reader to a file its route does not name is refused', f.some((x) => x.includes('one.md sends the reader to dev/skills/a/three.md') && x.includes('"One"')));
  const fixed = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['One', '[one](one.md), `three.md`']]), 'one.md': words(100) + ' Read [three](three.md) before this.', 'three.md': words(100) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  check('with the file in its row, it passes', skillSizeFaults(fixed, limits, none).length === 0);
}

// A split skill must route every part: no table, or a part no row names, is refused.
{
  const notable = tree({
    'dev/skills/a': { 'SKILL.md': front + words(300) + '\n\n**Every run reads:** `../shared/core.md`\n\nThen [one](one.md).', 'one.md': words(100) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  check('a split skill with parts and no routing table is refused', skillSizeFaults(notable, limits, none).some((x) => x.includes('no routing table')));
  const stray = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['One', '[one](one.md)']]) + '\nSee also [two](two.md).', 'one.md': words(100), 'two.md': words(100) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  check('a part no route names is refused', skillSizeFaults(stray, limits, none).some((x) => x.includes('two.md') && x.includes('no route')));
}

// A part's own opening line names the situation for reading it, and may name a
// sibling ("made by `offer.md`", "with `day.md`, not `missing.md`"); a redirect
// ("read `other.md` instead, not this") replaces rather than adds. Neither sends
// the reader on, where that file is on some route of the skill, so it is
// measured; a name on no route is never excused (T-692).
{
  const rows = [['Offer', '[offer.md](offer.md)'], ['Answer', '[answer.md](answer.md)'], ['Real', '[real.md](real.md)']];
  const sk = (files) => tree({ 'dev/skills/a': { 'SKILL.md': marked(300, rows), 'offer.md': words(100), 'real.md': words(100), 'stray.md': words(100), ...files }, 'dev/skills/shared': { 'core.md': words(300) } });
  const opening = sk({ 'answer.md': '# Answer\n\n**Read when:** she answers the offer (made by `offer.md`), not `real.md`.\n' + words(100) });
  check('a part\'s opening "Read when" line naming siblings on other routes does not send the reader on', skillSizeFaults(opening, limits, none).length === 0);
  const redirect = sk({ 'answer.md': 'Read when she answers. If she opens with something real, read `real.md` instead, not this.\n' + words(100) });
  check('"read X instead, not this" replaces this part and is not a send', skillSizeFaults(redirect, limits, none).length === 0);
  const genuine = sk({ 'answer.md': '**Read when:** she answers.\n\n' + words(100) + ' Then read `real.md` for the rest.\n' });
  check('a genuine "then read X" in a body sentence still faults', skillSizeFaults(genuine, limits, none).some((x) => x.includes('answer.md sends the reader to dev/skills/a/real.md')));
  const thenClause = sk({ 'answer.md': 'Read when she answers; then read `real.md` too.\n' + words(100) });
  check('a "then" clause inside the opening line still faults', skillSizeFaults(thenClause, limits, none).some((x) => x.includes('answer.md sends the reader to dev/skills/a/real.md')));
  const strayOpen = sk({ 'answer.md': '**Read when:** she answers, read with `stray.md`.\n' + words(100) });
  check('an opening line naming a file on no route still faults', skillSizeFaults(strayOpen, limits, none).some((x) => x.includes('answer.md sends the reader to dev/skills/a/stray.md')));
  const strayInstead = sk({ 'answer.md': 'Read when she answers.\n\n' + words(100) + ' If it is later, read `stray.md` instead, not this.\n' });
  check('a redirect to a file on no route still faults', skillSizeFaults(strayInstead, limits, none).some((x) => x.includes('answer.md sends the reader to dev/skills/a/stray.md')));
}

// Sent on when something comes up mid-run: measured where another route reads
// everything this route does and that file too; never where none does.
{
  const covered = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['Done', '[after.md](after.md)'], ['Done, a clinician named', '`after.md`, [care.md](care.md)']]), 'after.md': words(100) + ' Once she names one, read `care.md` and ask.', 'care.md': words(100) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  check('a send that another route reads together with all of this route is measured, so passes', skillSizeFaults(covered, limits, none).length === 0);
  const partial = tree({
    'dev/skills/a': { 'SKILL.md': marked(300, [['Done', '[after.md](after.md), [extra.md](extra.md)'], ['Clinician', '`after.md`, [care.md](care.md)']]), 'after.md': words(100) + ' Once she names one, read `care.md` and ask.', 'care.md': words(100), 'extra.md': words(100) },
    'dev/skills/shared': { 'core.md': words(300) },
  });
  check('where no route reads this route\'s files and the sent-to file together, it still faults', skillSizeFaults(partial, limits, none).some((x) => x.includes('after.md sends the reader to dev/skills/a/care.md') && x.includes('"Done"')));
}

// A wrapper (a dev- entry, or a skill moved into a module) reads its own body
// and then the target skill as the target is read: its body and its largest
// route. Counting the target's SKILL.md alone left a 2,559-word run as 854 (T-692).
{
  const target = { 'SKILL.md': marked(300, [['Big', '[one](one.md), [two](two.md)'], ['Small', '[one](one.md)']]), 'one.md': words(900), 'two.md': words(900) };
  const wrap = (n) => ({ 'SKILL.md': front + words(n) + '\n\n**Every run reads:** [`dev/skills/t/SKILL.md`](../../../dev/skills/t/SKILL.md), then its route.\n' });
  const over = tree({ 'dev/skills/t': target, 'dev/skills/shared': { 'core.md': words(300) }, '.claude/skills/dev-t': wrap(100) });
  const f = skillSizeFaults(over, limits, none);
  // 2518: the wrapper's 107 words, and the target's route "Big": its 311, the 300 every run reads, 900 and 900.
  check(`a wrapper is its body plus the target's largest route${f.length ? '' : ': nothing reported'}`, f.some((x) => x.includes('one run (.claude/skills/dev-t') && x.includes('through dev/skills/t: "Big"') && x.includes('2518 words')));
  check('the target itself, under the limit, is not reported', !f.some((x) => x.includes('one run (dev/skills/t')));
  const fits = tree({ 'dev/skills/t': target, 'dev/skills/shared': { 'core.md': words(300) }, '.claude/skills/dev-t': wrap(10) });
  check('a short wrapper over the same target passes', skillSizeFaults(fits, limits, none).length === 0);
}

// Every skill with parts says how it is read (T-692): the marker, or it is
// refused. Set-up alone is measured route by route by setup-size.mjs.
{
  const bare = { 'SKILL.md': front + words(300) + ' Then read [one](one.md).', 'one.md': words(100) };
  const f = skillSizeFaults(tree({ '.claude/skills/a': bare }), limits, none);
  check('a SKILL.md with parts and no **Every run reads:** line is refused', f.length === 1 && f[0].includes('.claude/skills/a/SKILL.md: it has parts but no **Every run reads:** line'));
  const withMarker = { 'SKILL.md': front + words(300) + '\n\n**Every run reads:** nothing beyond this page.\n' + table(['One', '[one](one.md)']), 'one.md': words(100) };
  check('the same skill with the marker and a routing row passes', skillSizeFaults(tree({ '.claude/skills/a': withMarker }), limits, none).length === 0);
  check('a skill with no parts needs no marker', skillSizeFaults(tree({ '.claude/skills/a': { 'SKILL.md': front + words(300) } }), limits, none).length === 0);
  check('set-up, unmarked, is exempt by name', skillSizeFaults(tree({ '.claude/skills/set-up': bare }), limits, none).length === 0);
}

// A missing threshold checks nothing (thresholds.mjs: null means do nothing).
check('no thresholds, no check', skillSizeFaults(tree({ '.claude/skills/a': { 'SKILL.md': front + words(5000) } }), {}, none).length === 0);

// The shipped tree, against the shipped thresholds and its own list at HEAD.
{
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const shipped = { mainWords: threshold('skills.mainWords', 'words'), partWords: threshold('skills.partWords', 'words'), runWords: threshold('skills.runWords', 'words') };
  check('the word thresholds are stated (skills.mainWords, skills.partWords, skills.runWords)', Boolean(shipped.mainWords && shipped.partWords && shipped.runWords));
  const f = skillSizeFaults(repo, shipped);
  check(`the shipped skills are within the limit or listed and not grown${f.length ? ': ' + f.join('; ') : ''}`, f.length === 0);
  check('set-up, split on 2026-11-02, is within every limit', !Object.keys(overs(repo, shipped)).some((k) => k.includes('/set-up')));
}

console.log(failed ? `skill size test: ${failed} failed` : 'skill size test: all passed');
process.exit(failed ? 1 : 0);
