// PreToolUse(Write|Edit|MultiEdit) — what this agent does not get to change.
//
// PARKED, NOT WIRED. This hook is not in .claude/settings.json; its entry sits
// in .claude/hooks/parked.json, which Claude Code never reads. Parked 2026-09-27
// on the developer's instruction: the agent may edit the whole harness, and git
// history is what makes any edit recoverable. So today nothing refuses an edit
// to CLAUDE.md, dev/specs/ or data/archive/; those rules are held by instruction
// (dev/skills/spec-shared/shared.md says the same). Everything below describes
// what the hook does when it is wired again, by moving its entry back into
// settings.json (.claude/hooks/README.md says how).
//
// CLAUDE.md — an agent that can rewrite its own constitution mid-session
//   has none. A proposed change is put to the developer to apply.
//
// dev/specs/** — every file in that folder opens with the same prohibition,
//   and dev/specs/README.md states it twice more. All three are instruction: text a
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
// There is no escape hatch, deliberately, and that is not free: the owner does
// grant spec edits in session, and with this branch on, each one has to be made
// by them or with the hook off. The CLAUDE.md branch above has carried exactly that cost since it
// was written, and one mechanism behaving two ways is worse than one that is
// occasionally inconvenient.
//
// It is also partial, in the way SFG-002's design column asks be admitted. It
// sees tool calls. It does not see `node scripts/check-spec-banner.mjs --fix`,
// or a `sed -i`, or anything else routed through Bash — the deletion guard in
// parked.json reads command lines for that reason, and nothing does the same
// for the specs. A gate on one door of two.

import { readHookInput, refuse, pass, isInside, repoRoot } from '../lib/hook.mjs';
import { join, relative, resolve } from 'node:path';
import { SPECS_DIR } from '../lib/paths.mjs';

const input = await readHookInput();
const path = input?.tool_input?.file_path ?? '';
if (!path) pass();

// The instruction file and its stub sit at the root (FND-010).
const fromRoot = relative(repoRoot, resolve(repoRoot, path)).replace(/\\/g, '/');
if (/^(CLAUDE|AGENTS)\.md$/i.test(fromRoot) || (isInside(path, join(repoRoot, '.claude')) && /CLAUDE\.md$/i.test(path))) {
  refuse(
    'PreToolUse',
    'Blocked: CLAUDE.md is not yours to edit.\n\n' +
      'Put the proposed change — and what in this session prompted it — to the ' +
      'developer in the conversation instead, for them to apply.',
  );
}

if (isInside(path, join(repoRoot, SPECS_DIR))) {
  refuse(
    'PreToolUse',
    'Blocked: dev/specs/ is the specification, and it is not yours to edit.\n\n' +
      'That covers every file in it and every kind of change — a reword, a reformat, ' +
      'a rename, a move, and the typo you are certain is harmless.\n\n' +
      'Raise the finding with your reasoning in the conversation, and leave it for a ' +
      'person to clear. Draft the replacement row ' +
      'paste-ready, and say which file it belongs in and where. Do not apply it.\n\n' +
      'A divergence between a spec and the repository is never resolved by amending the ' +
      'spec — the repository is what is wrong.',
  );
}

if (isInside(path, join(repoRoot, 'data', 'archive'))) {
  refuse(
    'PreToolUse',
    'Blocked: data/archive/ is a record of what the record used to say, and it is ' +
      'read-only.\n\nTo supersede something, write the new version in its live file and ' +
      '`git mv` the old one here unchanged. Nothing in the archive is edited or removed.',
  );
}

pass();
