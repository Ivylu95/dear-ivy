// SessionStart — /clear returns the chat to everyday.
//
// DEV-001, "A session follows development practice only when the developer has
// switched it on." The switch is stored per session, so it outlived /clear: a
// cleared chat opened in development mode and answered a normal question in
// the development shape (2026-09-30). A clear is a fresh start, so it starts
// in everyday; /dev-mode, or a plain request for development work, switches it
// back on. A resume or a compaction keeps the mode: the same work goes on, on a fresh machine
// too, from the chats saved as switched on (T-849).

import { readHookInput, pass } from '../lib/hook.mjs';
import { devModeOff, devModeRestore } from '../lib/dev-mode.mjs';

const input = await readHookInput();
if (process.env.DEAR_RECORD_READONLY === '1') pass(); // the selftest never switches a real chat
if (input?.source === 'clear') devModeOff(input);
else devModeRestore(input);
pass();
