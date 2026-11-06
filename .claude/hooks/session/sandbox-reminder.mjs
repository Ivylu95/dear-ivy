// UserPromptSubmit — in a sandbox chat, say so before every reply.
//
// The hooks follow the chat's record by themselves (hook.mjs). The instructions
// do not: CLAUDE.md, the skills and the specs all say `data/`, and in a sandbox
// chat the model is told to read that as `data-sandbox/`. Told once at the start,
// that drifts over a long chat or across a compaction; told on every message, it
// has nothing to drift from. Silent in every chat that is not a test.

import { readHookInput, context, pass } from '../lib/hook.mjs';
import { inSandbox, sessionId } from '../lib/sandbox.mjs';

const input = await readHookInput();
if (!inSandbox(sessionId(input))) pass();

context(
  'UserPromptSubmit',
  'SANDBOX: this chat uses data-sandbox/. Read every `data/` in CLAUDE.md, the skills and the specs as `data-sandbox/`; never read or write data/. Crisis handling is never sandboxed. `/sandbox off` returns this chat to data/.',
);
