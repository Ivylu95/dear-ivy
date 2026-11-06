#!/usr/bin/env node
// A-171 (E-123): the sentence check flags what a count can see, and leaves plain writing alone.
import { proseFaults, proseProblem, sentencesOf } from '../../.claude/hooks/lib/prose.mjs';

let failed = 0;
const ok = (cond, what) => { if (!cond) failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`); };

const plain = 'First it checks whether anyone is in danger. If not, it decides who the picture is for. Usually that is her.';
ok(proseFaults(plain).length === 0, 'plain sentences pass');
ok(sentencesOf(plain).length === 3, 'three sentences are read as three');

const clipped = 'Checks the crisis first, then picks one route: hers by default; his only when this turn carries the development lines.';
ok(proseFaults(clipped)[0]?.kind === 'chain', 'a colon chained to a semicolon is flagged');

const semis = 'It reads the record; it draws the week; it offers the page.';
ok(proseFaults(semis)[0]?.kind === 'semicolons', 'two semicolons in one sentence are flagged');

const long = 'This sentence goes on and on because it tries to hold several ideas at once, adding one clause after another, until the reader has to go back to the start to find out what it was about at all.';
ok(proseFaults(long)[0]?.kind === 'long', 'a sentence past thirty words is flagged');
ok(/runs to \d+ words \(A-171\)/.test(proseProblem(long)), 'the problem line names the length and the card');

ok(proseFaults('> ' + long).length === 0, 'a quoted line keeps its writer\'s words and is not flagged');
ok(proseFaults('```\n' + long + '\n```').length === 0, 'code is not prose');
ok(proseFaults('| a | b |\n|---|---|\n| ' + long + ' | x |').length === 0, 'a table is not prose');
ok(proseFaults('## ' + long).length === 0, 'a heading is not prose');
ok(proseFaults('See https://example.com/a;b;c for it.').length === 0, 'a link is not counted');
ok(proseFaults('- first item\n- second item\n- third item').length === 0, 'short list items pass');
ok(proseFaults('It was 3.5 hours. Then it stopped.').length === 0, 'a decimal does not end a sentence wrongly');

ok(proseFaults('~~one step done~~ ⟶ ~~another step done~~ ⟶ 🟢 **the step under way now, with a long name that runs on and on and on** ⟶ the next step ⟶ the last one to come').length === 0, 'a progress line is not a sentence');

ok(proseFaults('This sentence is wrapped across two lines of a file the way skills are,\nand it keeps on going past thirty words because the second line carries on with more and more of it.')[0]?.kind === 'long', 'a sentence wrapped across lines is read whole');
ok(proseFaults('- **Indented items** carry on\n  onto a second line; and a third part; all one sentence.')[0]?.kind === 'semicolons', 'a list item wrapped onto an indented line is read whole');
ok(proseFaults('Short label\nAnother short line').length === 0, 'short lines stay apart');

console.log(failed ? `\n${failed} failed` : '\nprose check: all cases hold');
process.exit(failed ? 1 : 0);
