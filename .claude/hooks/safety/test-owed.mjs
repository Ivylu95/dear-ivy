// Rule test for owed.mjs: once the safety question is asked, the floor reminds
// until a reply names a person and a line, and stops when she asks it to.
//
// Run: node .claude/hooks/safety/test-owed.mjs

import { owedState, owedLines } from './owed.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const her = (text) => ({ type: 'user', message: { content: text } });
const reply = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

check('nothing owed before the question', owedLines(owedState([her('whats the point'), reply('That sounds heavy.')])).length === 0);

const asked = owedState([her('whats the point'), reply("I'm an AI, not a person. Are you safe right now?"), her('yeah im safe')]);
check('after the question, a person and a line are owed', owedLines(asked).length === 3 && owedLines(asked).join(' ').includes('one person she could reach and one line'));

const here = owedState([reply('Are you safe right now?'), her('yes'), reply("I'm here whenever you want to keep going.")]);
check('"I\'m here" pays nothing', owedLines(here).length === 3);

const lineOnly = owedState([reply('Are you safe right now?'), her('yes'), reply('If a night gets heavier, SOS is on 1767.')]);
check('a line alone still owes the person', owedLines(lineOnly).join(' ').includes('one person she could reach') && !owedLines(lineOnly).join(' ').includes('and one line'));

const both = owedState([reply('Are you safe right now?'), her('yes'), reply('Is there someone you could tell about tonight? And mindline is on 1771 if it gets heavier.')]);
check('a person and a line named: nothing owed', owedLines(both).length === 0);

const gp = owedState([reply('Are you safe right now?'), her('yes'), reply("It's worth telling your GP. SOS is on 1767 for a worse night.")]);
check('her GP counts as the person', owedLines(gp).length === 0);

const ambulance = owedState([reply('Are you safe right now?'), her('yes'), reply('If there is chest pain, call 995. Is there someone you could tell?')]);
check('the emergency number for chest pain is not the line', owedLines(ambulance).join(' ').includes('one line'));

const crisis = (t) => /what'?s the point/.test(t);
const early = owedState([her('whats the point'), reply('That sounds heavy.')], crisis);
check('one reply in, staying with her: nothing due yet', owedLines(early).length === 0);
const late = owedState([her('whats the point'), reply('That sounds heavy.'), her('idk'), reply('Tell me more.')], crisis);
check('two replies without the question: it is due', owedLines(late).join(' ').includes('Are you safe right now?'));
const calm = owedState([her('work was fine'), reply('Good.'), her('yes'), reply('Nice.')], crisis);
check('no crisis message: nothing due', owedLines(calm).length === 0);

const dropped = owedState([reply('Are you safe right now?'), her('pls stop giving me numbers, just listen')]);
check('she asks it to stop: nothing owed', owedLines(dropped).length === 0);

const relayed = owedState([reply('Are you safe right now?'), her('<task-notification>stop giving me numbers</task-notification>')]);
check('a relayed note is not her asking to stop', owedLines(relayed).length === 3);
const noted = owedState([her('<system-reminder>files re-read</system-reminder>\nwhats the point'), reply('That sounds heavy.'), reply('I hear you.')], (t) => t.includes('whats the point'));
check('her words after a system note count as hers', noted.crisis && noted.unasked === 2);
const report = owedState([her('<agent-message from="a1">quotes: whats the point</agent-message>'), reply('Merged.'), reply('Pushed.')], (t) => t.includes('whats the point'));
check('crisis words inside a relayed report are not hers', !report.crisis && owedLines(report).length === 0);

if (failed) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log('\nowed: all cases hold');
