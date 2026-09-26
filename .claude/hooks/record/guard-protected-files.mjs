// PreToolUse(Write|Edit|MultiEdit) — what this agent does not get to change.
//
// .claude/CLAUDE.md — CLAUDE.md: "Never edit this file yourself - when a session
//   shows a rule is missing, wrong, or landed badly, write the proposed change
//   and what prompted it to data/state/proposals.md for a developer to apply by
//   hand." An agent that can rewrite its own constitution mid-session has none.
//
// specs/** — every file in that folder opens with the same prohibition,
//   and specs/README.md states it twice more. All three are instruction: text a
//   model reads and may decide this edit is the harmless exception to. SFG-002
//   is the row that objects — "a rule enforced by machinery is distinguishable
//   from one enforced by instruction" — and until this branch existed, the
//   repository's most-repeated rule had no machinery at all behind it.
//
// data/archive/** — the archive is what the record used to say. Editing it
//   rewrites the past rather than superseding it, which is the one thing the
//   never-delete rule exists to prevent.
//
// Every refusal names the move that is allowed instead, so the turn continues.
//
// ── The cost, stated rather than discovered ─────────────────────────────────
//
// There is no escape hatch, deliberately, and that is not free: REVIEW.md keeps
// an "Authorised edits" section because the owner does grant spec edits in
// session, and with this branch on, each one has to be made by them or with the
// hook off. The CLAUDE.md branch above has carried exactly that cost since it
// was written, and one mechanism behaving two ways is worse than one that is
// occasionally inconvenient.
//
// It is also partial, in the way SFG-002's design column asks be admitted. It
// sees tool calls. It does not see `node scripts/check-spec-banner.mjs --fix`,
// or a `sed -i`, or anything else routed through Bash — the deletion guard in
// parked.json reads command lines for that reason, and nothing does the same
// for the specs. A gate on one door of two.

import { readHookInput, deny, pass, isInside, repoRoot } from '../lib/hook.mjs';
import { join } from 'node:path';

const input = await readHookInput();
const path = input?.tool_input?.file_path ?? '';
if (!path) pass();

if (isInside(path, join(repoRoot, '.claude')) && /CLAUDE\.md$/i.test(path)) {
  deny(
    'PreToolUse',
    'Blocked: CLAUDE.md is not yours to edit.\n\n' +
      'Write the proposed change — and what in this session prompted it — to ' +
      'data/state/proposals.md instead, for a developer to apply by hand. Say in the ' +
      'conversation that you have done so.',
  );
}

// The findings queue is the one file inside the folder that must stay open. It
// is written by the agent — that is what it is for — and a guard that refuses
// the edit while the refusal tells the agent to file a finding there would
// close the only route it names. The queue was split on 2026-09-21: findings
// whose fix lands inside specs/ go to the REVIEW.md in that folder,
// everything else to .claude/REVIEW.md. Either name is a destination, never a
// spec, so both are matched by name rather than by path.
const isFindingsQueue = /(^|[\\/])REVIEW\.md$/i.test(path);

if (!isFindingsQueue && isInside(path, join(repoRoot, 'specs'))) {
  deny(
    'PreToolUse',
    'Blocked: specs/ is the specification, and it is not yours to edit.\n\n' +
      'That covers every file in it and every kind of change — a reword, a reformat, ' +
      'a rename, a move, and the typo you are certain is harmless.\n\n' +
      'Write the finding with your reasoning and leave it for a person to clear, in the ' +
      'queue its fix lands beside: specs/REVIEW.md where the spec file is wrong ' +
      'or a better row has presented itself, .claude/REVIEW.md where the repository ' +
      'departs from a row. Draft the replacement row in the conversation, paste-ready, ' +
      'and say which file it belongs in and where. Do not apply it.\n\n' +
      'A divergence between a spec and the repository is never resolved by amending the ' +
      'spec — the repository is what is wrong.',
  );
}

if (isInside(path, join(repoRoot, 'data', 'archive'))) {
  deny(
    'PreToolUse',
    'Blocked: data/archive/ is a record of what the record used to say, and it is ' +
      'read-only.\n\nTo supersede something, write the new version in its live file and ' +
      '`git mv` the old one here unchanged. Nothing in the archive is edited or removed.',
  );
}

pass();
