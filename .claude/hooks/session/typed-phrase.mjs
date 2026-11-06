// UserPromptSubmit — records an approval phrase a person typed themselves.
//
// Two approvals in the harness release flow are a phrase typed exactly, never a
// "yes": the developer's release phrase (`RELEASE v1.4 7F2K`) and a person's
// update phrase (`update to version 1.4 7F2K`). The code ties each to one
// fingerprinted release, so an old phrase does not approve a new one. The
// release tooling and the updater act only on what this hook recorded, and
// guard-secrets.mjs refuses any tool that names the record, so an agent cannot
// approve on anyone's behalf.
//
// As with unlock-safety-core.mjs: the phrase counts only as the first line of
// the message, typed on its own, and never inside a frame the harness wraps
// relayed text in (a subagent's report quoting it once unlocked the core).
// A phone capitalises the first letter, so the words are matched without case
// and stored in their canonical form.
//
// The developer's `/dev-mode sandbox <action>` is recorded the same way
// (WKB-013), and ux/scripts/sandbox.mjs switches only on it. It lasts the turn
// it was typed in: any later message clears one left unspent.

import { readHookInput, markerSeen, markerWrite, pass } from '../lib/hook.mjs';
import { PHRASE_MARKER } from '../lib/update/secrets.mjs';
import { normaliseCode as code } from '../lib/update/release-lib.mjs';
import { sandboxAction, redTeamTyped } from '../lib/dev-mode.mjs';
import { sessionId, switchMarker, inSandbox } from '../lib/sandbox.mjs';

const input = await readHookInput();
const prompt = String(input?.prompt ?? '');
const session = String(input?.session_id ?? '').replace(/[^\w-]/g, '');

const RELAYED = /<agent-message\b|\[Subagent hand-back\]|<task-notification\b|<system-reminder\b|<teammate-message\b|\[SYSTEM NOTIFICATION/i;
const first = prompt.split('\n').find((l) => l.trim())?.trim() ?? '';

const release = /^RELEASE v(\d+(?:\.\d+)*) ([0-9A-Z]{4})$/i.exec(first);
const update = /^update to version (\d+(?:\.\d+)*) ([0-9A-Z]{4})$/i.exec(first);

const id = sessionId(input);
// `/dev-red-team` is the same switch in one word: off if this chat is in the test, else on.
const sandbox = RELAYED.test(prompt) ? null : sandboxAction(prompt) ?? (id && redTeamTyped(prompt) ? (inSandbox(id) ? 'off' : 'on') : null);
if (id && (sandbox || markerSeen(switchMarker(id)))) markerWrite(switchMarker(id), sandbox ? JSON.stringify({ action: sandbox }) : '');

// A phrase lasts the turn it was typed in, as the sandbox switch does: her next
// message without one clears it, so a phrase typed for one check cannot approve a
// later one (edge cases, 2026-10-29, D-G9). A relayed frame is not her message
// and clears nothing: it can arrive mid-turn, before the phrase is used.
const marker = `${PHRASE_MARKER}${session}`;
if (session && !RELAYED.test(prompt) && !(release || update) && markerSeen(marker)) markerWrite(marker, '');

if (!session || RELAYED.test(prompt) || !(release || update)) pass();

// The code is read as its alphabet (release-lib.mjs normaliseCode): an I or L is
// a 1, an O a 0 (edge cases, 2026-10-29, B2).
const phrase = release
  ? `RELEASE v${release[1]} ${code(release[2])}`
  : `update to version ${update[1]} ${code(update[2])}`;
markerWrite(marker, JSON.stringify({ phrase, at: new Date().toISOString() }));
pass();
