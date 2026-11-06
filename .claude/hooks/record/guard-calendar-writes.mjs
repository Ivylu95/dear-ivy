// PreToolUse on the Google Calendar connector's writing tools — the owner's
// agreement A-121: her calendar is written only in a chat, on her yes to a
// draft, never with anyone else on the event, never from a run with no one
// present.
//
// What code can decide, it does:
//   - a create or update that names attendees, or asks Google to notify guests,
//     is refused: an invitation reaches a real person;
//   - answering an invitation is refused: it speaks to the organiser for her;
//   - any write in an unattended run (the heartbeat, which opens "You run
//     unattended") is refused: nobody is there to say yes.
// Her yes to the draft, and touching only what she named, stay with the
// calendar skill: no hook can read whether a yes was meant.

import { readFileSync } from 'node:fs';
import { readHookInput, refuse, pass } from '../lib/hook.mjs';

const input = await readHookInput();
const tool = String(input?.tool_name ?? '');
const m = /^mcp__Google_Calendar__(create_event|update_event|delete_event|respond_to_event)$/.exec(tool);
if (!m) pass();
const action = m[1];
const args = input?.tool_input ?? {};

/** True when this session was started by the heartbeat's own prompt. */
export function unattended(transcriptPath) {
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      if (e.type !== 'user') continue;
      const c = e.message?.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p?.text ?? '').join(' ') : '';
      return /^\s*You run unattended\b/.test(text);
    }
  } catch {
    /* no transcript: judged a chat; the other rules still hold */
  }
  return false;
}

const named = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));
if (unattended(input?.transcript_path)) {
  refuse('PreToolUse', `Refused: a ${action.replace('_', ' ')} from a run with no one present (A-121). Her calendar is written only in a chat, on her yes to a draft.`);
}
if (action === 'respond_to_event') {
  refuse('PreToolUse', 'Refused: answering an invitation speaks to its organiser for her (A-121). Tell her what it is, and she answers it in Google Calendar.');
}
if (['attendees', 'attendeeEmails', 'addedAttendees', 'addedAttendeeEmails'].some((k) => named(args[k]))) {
  refuse('PreToolUse', 'Refused: an event with guests sends an invitation to a real person (A-121). Write it with no attendees; she adds anyone herself in Google Calendar.');
}
// A change to, or a cancellation of, an event that already has guests emails
// them unless told not to: Google's default for both is ALL (T-330).
if ((action === 'update_event' || action === 'delete_event') && args.notificationLevel !== 'NONE') {
  const what = action === 'update_event' ? 'a change' : 'a cancellation';
  refuse('PreToolUse', `Refused: ${what} sends email to any guests already on the event unless notificationLevel is "NONE" (A-121). Send it again with notificationLevel "NONE".`);
}
pass();
