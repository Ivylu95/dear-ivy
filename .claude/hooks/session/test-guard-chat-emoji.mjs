// Rule test for guard-chat-emoji.mjs (card A-169): a chat an agent starts or renames is refused
// unless its name begins with an emoji, and every chat on the chat list has one.
//
// Run: node .claude/hooks/session/test-guard-chat-emoji.mjs

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startsWithEmoji, verdict } from './guard-chat-emoji.mjs';

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed++; };
const C = 'mcp__claude-code-remote__create_session';
const R = 'mcp__claude-code-remote__set_session_title';
check('an emoji of every kind counts: a pictograph, one with a joiner, a flag, a keycap', ['📨 A', '🧑‍🏫 B', '🇸🇬 C', '1️⃣ D', '☀️ E'].every(startsWithEmoji));
check('a plain word, a leading dash or digit alone does not', !['Loop check', '- 📨 A', '1 thing', ''].some(startsWithEmoji));
check('starting a chat with an emoji name goes ahead', verdict(C, { title: '🔎 Check: dev bot key' }) === '');
check('starting a chat with a plain name is refused', /A-169/.test(verdict(C, { title: 'Loop automation check' })));
check('starting a chat with no name is refused', /A-169/.test(verdict(C, {})));
check('renaming to a plain name is refused; to an emoji name goes ahead', /A-169/.test(verdict(R, { session_id: 's', title: 'Plain' })) && verdict(R, { session_id: 's', title: '🧽 Tidy' }) === '');
check('any other tool is left alone', verdict('mcp__claude-code-remote__send_message', { message: 'hi' }) === '' && verdict('Bash', {}) === '');
const list = join(fileURLToPath(new URL('../../..', import.meta.url)), 'data', 'core', 'state', 'chats.json');
const chats = existsSync(list) ? JSON.parse(readFileSync(list, 'utf8')).chats ?? [] : [];
const bare = chats.filter((c) => !startsWithEmoji(c?.title));
check(`every chat on the chat list begins with an emoji (${chats.length} listed)`, bare.length === 0);
console.log(failed ? `chat emoji guard: ${failed} failed` : 'chat emoji guard: all cases hold');
process.exit(failed ? 1 : 0);
