// Rule test for check-id-clash.mjs: an ID both sides made since they parted, naming
// different things, is a clash; the same thing on both, or an ID from before, is not.
//
//   node ux/scripts/test-check-id-clash.mjs

import assert from 'node:assert/strict';
import { cardSays, clashes, evalTitles } from './check-id-clash.mjs';

const m = (o) => new Map(Object.entries(o));

assert.deepEqual(clashes(m({}), m({ 'E-074': 'A live check' }), m({ 'E-074': 'A morning message' })).map((c) => c.id), ['E-074'], 'both made E-074 for different things: a clash');
assert.equal(clashes(m({}), m({ 'E-074': 'Same' }), m({ 'E-074': 'Same' })).length, 0, 'the same card on both sides is no clash');
assert.equal(clashes(m({ 'E-010': 'Old' }), m({ 'E-010': 'Old, edited here' }), m({ 'E-010': 'Old, edited there' })).length, 0, 'an ID from before they parted is no clash');
assert.equal(clashes(m({}), m({ 'E-090': 'Mine' }), m({ 'E-074': 'Theirs' })).length, 0, 'a number main does not have is free');

const titles = evalTitles([['dev/evals/cards/E-074.md', '---\nid: E-074\ntitle: A live check\n---\n'], ['README.md', 'x']]);
assert.equal(titles.get('E-074'), 'A live check', 'an eval title is read from its card');
assert.equal(titles.size, 1, 'only eval cards are read');

const says = cardSays(['### T-1 · 2026-10-28 · 🤝 agreement\n> yes\n- **Card A-124** · status: agreed · emoji: 🪞 · group: 5 x · order: 4\n  - **Says:** A persona kept in my record.\n  - **Why:** because.\n']);
assert.equal(says.get('A-124'), 'A persona kept in my record.', "an agreement card's Says line is read");

console.log('id clash test: an ID both sides made for different things is caught; the same card, an old ID, a free number pass');
