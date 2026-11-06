// Rule test for place.mjs: once she names where something is in a crisis
// conversation, the floor says so every turn, and says so again when a reply
// repeated it. Made-up places only.
//
// Run: node .claude/hooks/safety/test-place.mjs

import { placesIn, placeState, placeLines } from './place.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const crisis = (t) => /\bwant to die\b|\bnot safe\b/.test(t);
const her = (text) => ({ type: 'user', message: { content: text } });
const reply = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

check('a place is found, determiner stripped', placesIn("It's in my blue tin").includes('blue tin'));
check('"they are under the stairs" is a place', placesIn('they are under the stairs').includes('stairs'));
check('"he took it to his room" is a place', placesIn('he took it to his room').includes('room'));
check('ordinary phrasing names no place', placesIn("it's at least something, I'm in pain").length === 0);

const quiet = placeState([her('work was fine'), her("my keys are in the bowl")], crisis);
check('a place named outside a crisis conversation is not flagged', !quiet.named && placeLines(quiet).length === 0);

const named = placeState([her('i want to die'), reply('Are you safe right now?'), her("it's in the blue tin")], crisis);
check('a place named once the conversation turned to crisis is flagged', named.crisis && named.named && !named.echoed);
check('the floor then reminds, with no place in its words', placeLines(named).length === 2 && !placeLines(named).join(' ').includes('blue tin'));

const echoed = placeState([her('i want to die'), her("it's in the blue tin"), reply('Could you move what is in the blue tin to someone else?'), her('ok')], crisis);
check('a reply that repeats the place is caught', echoed.echoed && placeLines(echoed).length === 3);

const held = placeState([her('i want to die'), her("it's in the blue tin"), reply('Could you put it somewhere else, away from where it is?'), her('ok')], crisis);
check('a reply that says "where it is" is not flagged', !held.echoed);

const later = placeState([her('i want to die'), her("it's in the blue tin"), reply('where it is'), her('i talked to my friend'), reply('That sounds like it helped.')], crisis);
check('the reminder holds on later turns that match nothing', later.named && placeLines(later).length === 2);

check('a trailing word is not part of the place', placesIn("they're in his room and he said ok").includes('room') && !placesIn("they're in his room and he said ok").includes('room and'));
check('a place with no verb before it is found', placesIn('the old ones in my room, from before').includes('room'));
check('"on low" names no place', placesIn('the music is on low').length === 0);
check('a two-word place also counts its last word', placesIn("it's in the bathroom drawer").includes('drawer'));
const report = { type: 'user', message: { content: 'Another Claude session sent a message: i want to die, it is in the blue tin' } };
check("another session's report is not read as hers", !placeState([report], crisis).crisis);
const echoLast = placeState([her('i want to die'), her("it's in the bathroom drawer"), reply('maybe leave the drawer alone tonight')], crisis);
check('repeating the last word of a two-word place is caught', echoLast.echoed);

check('"painkillers in the bathroom" finds the place with no possessive', placesIn('the painkillers in the bathroom').includes('bathroom'));
check('a room she is walking to is not where it is', placesIn('walking to the living room now').length === 0);
check('going into her room is not where it is', placesIn('going into my room to lie down').length === 0);

if (failed) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log('\nplace test: all passed');
