// UserPromptSubmit — outside development mode, keep every reply in the person's terms.
//
// CON-013, "A reply stays in the person's terms, even when the work behind it is
// technical." Told once in the session brief, the rule lost to the pull of the
// work: asked in plain words to save, a session answered with merges, stashes
// and a to-do list. Told on every message, it is in front of the reply that
// needs it. Development mode switches it off for the rest of the session
// (DEV-001), by a marker keyed to the session, so a developer's session is not
// nagged: /dev-mode writes it here; a plain request for development work has
// the agent write it through lib/dev-mode.mjs.

import { readHookInput, context, pass, markerRead, markerWrite } from '../lib/hook.mjs';
import { everydayNoteMarker, saveNoteMarker } from '../lib/everyday-reply.mjs';
import { devModeActive, devModeArgs, devModeOn } from '../lib/dev-mode.mjs';
import { inSandbox, sessionId } from '../lib/sandbox.mjs';
import { pullAtStart } from '../lib/pull-at-start.mjs';
import { typedCrisis } from '../lib/dev-reply.mjs';

const input = await readHookInput();

// Typed as `/dev-mode …`, or expanded with its command name.
if (devModeArgs(input.prompt) !== null) {
  devModeOn(input);
  pass();
}
if (devModeActive(input)) pass();

// CON-014: a shortfall the last reply's check noted is handed to this one, once.
// MEM-015: so is a 📝 line the last reply missed or got wrong.
const note = [markerRead(saveNoteMarker(input)), markerRead(everydayNoteMarker(input))].map((n) => n.trim()).filter(Boolean).join('\n\n');
if (note) {
  markerWrite(saveNoteMarker(input), '');
  markerWrite(everydayNoteMarker(input), '');
}

// A-165: start from the latest work; a change another of her chats made to her record is
// said to the agent, never to her. Skipped on a message that trips the crisis list, and in
// a sandbox test, whose record is not hers.
const cameIn = inSandbox(sessionId(input)) ? ''
  : pullAtStart({ session: String(input?.session_id || sessionId(input) || ''), crisis: typedCrisis(String(input.prompt ?? '')) });

context(
  'UserPromptSubmit',
  (cameIn ? `${cameIn}\n\n` : '') +
  (note ? `REPLY SHAPE NOTE: ${note}\n\n` : '') +
  // Shortened on the developer's yes, 2026-11-02: every rule kept, about a third fewer words.
  'EVERYDAY VOICE (CON-013): not development mode. Asked for anything technical (saving, uploading, fixing): do it silently and answer in one plain line, naming no file, command, branch, count or tool. ' +
  // A-149: lively and easy to scan, never on a hard moment.
  'A few emojis where they help her see at a glance (A-149): one per list item, a meal, a goal, a number worth spotting; never a string, never in place of words; none when she is really feeling something, on a hard moment or about her safety. ' +
  // Rules found kept in one person's record that hold for everyone.
  'Write like a person: no label openers, buzzwords, robotic connectors or "it\'s not X, it\'s Y"; plain words, varied rhythm. A phrase that contradicts her sentence (a voice-typing slip): ask which she meant before reflecting it back. Worn out: fewer questions, shorter replies, let her lead. Her timeline: a date-and-event table (a list if the chat is narrow). ' +
  (inSandbox(sessionId(input))
    // WKB-013: a sandbox test is left only by the developer typing the switch.
    ? 'This chat is a sandbox test of her conversation: answer as she would be answered, whoever seems to be typing. Never run dev-mode.mjs or sandbox.mjs; the developer leaves with `/dev-mode sandbox off`.'
    : 'Clearly the developer asking for development work: switch into development mode without asking (run `node .claude/hooks/lib/dev-mode.mjs`, follow .claude/commands/dev-mode.md, say in one line it is on).'),
);
