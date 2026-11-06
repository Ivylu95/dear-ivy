// PreToolUse(Write|Edit|MultiEdit|NotebookEdit|Bash) — no access key lands in a
// file, and no tool forges an approval a person has to type.
//
// PRV-003, "A credential never enters version control." A key pasted into the
// chat to fetch a harness update is the one credential that passes through a
// session, and the rule to record what surfaces would otherwise write it into
// the record, where history keeps it forever. So any write carrying a key is
// refused, wherever it is going; the only command that may carry one is the
// updater itself, given the key in its own variable, with nothing chained.
//
// The typed approval phrase (release and update) counts only when a person
// typed it: typed-phrase.mjs records it from their message. A tool that names
// that record is refused, so the agent cannot write an approval for them. The
// same holds for writing the record of what the developer typed in development
// mode, which his yes to a card or a spec row is checked against: a call that
// would write it is refused; reading it, or mentioning it in prose, is not.
//
// Falls short in that a shell command can write a path it does not name
// at all (a script file, a name built where neither the folder nor the record
// is spoken of), and a key in a shape GitHub does not use
// is not recognised. The commit gate scans for keys again before anything is
// committed, and the environment's network limit is the backstop.

import { readHookInput, refuse, pass } from '../lib/hook.mjs';
import { PHRASE_MARKER, hasToken, isUpdaterCall } from '../lib/update/secrets.mjs';
import { READ_TOOLS, aimedAt, shellWrites } from '../lib/typed-guard.mjs';

const input = await readHookInput();
const tool = input?.tool_name ?? '';
const args = input?.tool_input ?? {};
const text = JSON.stringify(args);

if (text.includes(PHRASE_MARKER)) {
  refuse(
    'PreToolUse',
    'That is the record of an approval phrase a person typed, and only their own message writes it. Ask them to type the phrase.',
  );
}

// The record of what the developer typed: lib/typed-guard.mjs says whether a call writes it.
const typedWrite = tool === 'Bash' ? shellWrites(args.command ?? '') : !READ_TOOLS.has(tool) && aimedAt(args);
if (typedWrite) {
  refuse(
    'PreToolUse',
    'That would change the record of what the developer typed, and only his own message writes it: ask him to say it. Reading it is fine. It is staged as it is written, so a commit carries it without naming it.',
  );
}

if (!hasToken(text)) pass();

if (tool === 'Bash' && isUpdaterCall(args.command)) pass();

refuse(
  'PreToolUse',
  'That would put an access key somewhere it stays. A key pasted to fetch an update is used once, by ' +
    "`DEAR_RELEASE_KEY='<key>' node .claude/hooks/lib/update/update.mjs fetch`, and written nowhere: " +
    'not in a file, not in the record, not in git settings. Never repeat it back, and do not mention this to her.',
);
