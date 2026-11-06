// SessionStart — what a session must know before its first word, split by who it
// is for: the conversation, or the developer (held back unless she raises it).
//
// 1. A previous session could not save. Nothing else matters until that is true
//    again, so it is said first and in plain words.
// 2. Local commits that are not on the remote — the same failure, quieter.
// 3. A session branch that never reached main. A phone session saves to its own
//    `claude/` branch and .github/workflows/merge-sessions.yml carries it into
//    main; when that merge fails, what was said there is missing from every
//    later session, and this is the check made from somewhere other than the
//    machine that failed (DEP-006).
// 4. data/profile.yaml has a mandatory or recommended question still owed. The
//    owed ones are named here, with why each is empty, and first-contact asks
//    for them one at a time. A profile in the old flat shape is migrated first.
// 5. The record is still unwritten, so `first-contact` applies.
//
// On a session branch it also brings main in first, so a session resumed after
// others have saved starts from what they wrote rather than from what it cloned.
//
// Prints; never blocks. A session that cannot start is worse than an unwarned one.
//
// The fetch is the one slow thing any hook does — measured at ~2s, on the
// critical path of her first message. It is skipped when git fetched this
// repository in the last ten minutes, which covers reopening a session, and paid
// otherwise: without a current remote ref, the unpushed count is measured
// against a stale one, and the warning it feeds is the one that says everything
// is saved when nothing is.

import { readHookInput, context, pass, read, git, gitOk, dataDir, realDataDir, existsFile, repoRoot } from '../lib/hook.mjs';
import { inSandbox } from '../lib/sandbox.mjs';
import { statSync } from 'node:fs';
import { migrateIfLegacy, profilePath, record } from '../lib/profile.mjs';
import { join, relative } from 'node:path';

const FETCH_IS_FRESH_FOR = 10 * 60 * 1000;

function fetchedRecently() {
  try {
    return Date.now() - statSync(join(repoRoot, '.git', 'FETCH_HEAD')).mtimeMs < FETCH_IS_FRESH_FOR;
  } catch {
    return false; // No record of a fetch is a reason to fetch, not to skip.
  }
}

const input = await readHookInput();
// Two audiences. `lines` is what the conversation needs. `devLines` is the state
// of the save machinery — branches, merges, unpushed commits — which is the
// developer's business: it is held back from an everyday chat unless she raises
// development work herself (DEV-001, CON-003).
const lines = [];
const devLines = [];

if (existsFile(join(realDataDir, 'state', 'PUSH_FAILED.md'))) {
  devLines.push(
    'WARNING: a previous session could not push data/ — see data/state/PUSH_FAILED.md, verify and push before writing more.',
  );
}

if (!fetchedRecently()) git(['fetch', '-q', 'origin'], { timeout: 20000 });

const current = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const branch = current && current !== 'HEAD' ? current : null;
if (!branch) devLines.push('WARNING: the checkout is on a detached HEAD, so nothing written here can be pushed.');

if (branch && branch !== 'main' && !gitOk(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'])) {
  if (!gitOk(['merge', '-q', '--no-edit', 'origin/main'])) {
    gitOk(['merge', '--abort']);
    devLines.push(`WARNING: main could not be merged into ${branch} — this session may be missing what later sessions wrote.`);
  }
}

// On no remote branch at all: main just merged in is already saved, and is not counted.
const unpushed = Number(git(['rev-list', '--count', 'HEAD', '--not', '--remotes=origin']).trim() || 0);
if (unpushed > 0) devLines.push(`WARNING: ${unpushed} commit(s) on this branch are on no remote branch — unsaved.`);

const stranded = git(['branch', '-r', '--no-merged', 'origin/main', '--list', 'origin/claude/*'])
  .split('\n')
  .map((line) => line.trim())
  .filter((ref) => ref && ref !== `origin/${branch}`);
if (stranded.length) {
  devLines.push(
    `WARNING: ${stranded.length} earlier session branch(es) never reached main, so what was saved there is missing here: ${stranded.join(', ')}. Merge them into main before relying on the record.`,
  );
}

// The profile, read through the one schema every other reader uses
// (lib/profile-schema.mjs, via lib/profile.mjs; no dependencies). A record still in
// the old flat shape is migrated first, the old file kept in archive/.
const migrated = migrateIfLegacy(dataDir);
if (migrated) {
  lines.push(
    `PROFILE MIGRATED: ${relative(repoRoot, dataDir)}/profile.yaml was rewritten in the three-section shape; the old file is at ${relative(repoRoot, migrated)}. Nothing to say to her about it.`,
  );
}
const profileText = read(profilePath(dataDir));
const profile = record.readProfile(profileText);
if (profileText && profile.errors.length) {
  lines.push(
    [
      `PROFILE INVALID: ${relative(repoRoot, dataDir)}/profile.yaml breaks its rules. Fix it before writing anything else to it (the rules are in its header):`,
      ...profile.errors.slice(0, 10).map((e) => `  - ${e}`),
    ].join('\n'),
  );
}

const now = record.zonedDateTime(new Date(), profile.value.timezone ?? 'UTC');
const owed = record.owedQuestions(profile.questions);
const note = ({ status, status_reason, last_updated }) =>
  status === 'asked'
    ? ` [ASKED BEFORE ${last_updated}${status_reason ? `: ${status_reason}` : ''}. Say so ("last time I asked…"); never "I haven't asked"]`
    : status === 'removed'
      ? ` [REMOVED ${last_updated}. Answered once and taken out; never "I never asked", never the old answer]`
      : '';
const mandatory = owed.filter((q) => q.section === 'mandatory');
const recommended = owed.filter((q) => q.section === 'recommended');
if (owed.length) {
  lines.push(
    [
      `PROFILE INCOMPLETE: ${relative(repoRoot, dataDir)}/profile.yaml has ${mandatory.length} mandatory and ${recommended.length} recommended question(s) still owed. Load first-contact. Mandatory first, before anything else; then recommended, which can wait for a pause if she arrives with something on her mind. ONE per message, each with its reason and her permission. As you ask one, set status: asked; as she answers, status: answered with her words in value. Every change sets last_updated to now (${now}) and is checked the moment it is saved.`,
      ...mandatory.map((q) => `  - mandatory.${q.key}: ${record.QUESTIONS[q.key].describe}${note(q)}`),
      ...recommended.map((q) => `  - recommended.${q.key}: ${record.QUESTIONS[q.key].describe}${note(q)}`),
      'Anything she would rather not answer: status declined, with revisit_when saying what would make it matter again; asked again only when that comes up. Crisis outranks all of this: if she is unsafe, stop asking.',
    ].join('\n'),
  );
}

const declined = record.declinedQuestions(profile.questions);
if (declined.length) {
  lines.push(
    [
      'DECLINED, not owed: ask again only when the conversation makes one matter, never as an opener:',
      ...declined.map((q) => `  - ${q.section}.${q.key}: revisit when ${q.revisit_when.replace(/\s+/g, ' ')}`),
    ].join('\n'),
  );
}

if (read(join(dataDir, 'me', 'about_me.md')).includes('<!-- unfilled:')) {
  lines.push(
    'FIRST CONTACT: the record is empty — nothing real is written about her yet. The first-contact skill applies for the opening, then hand back to check-in. Beyond the profile, ask on a need-to-know basis only.',
  );
}

// Last, so it lands first: the reader must know which record every line above
// was read from before trusting any of it.
if (inSandbox()) {
  lines.unshift(
    'ACTIVE RECORD: data-sandbox/ — this chat is a test. Read every `data/` in CLAUDE.md, the skills and the specs as `data-sandbox/`, and never read or write data/. Crisis handling is never sandboxed.',
  );
}

// Always said, because the default is the thing most easily forgotten: a chat
// is everyday until she makes it about the system.
lines.push(
  'EVERYDAY UNLESS SHE SAYS OTHERWISE: if she opens with a greeting or anything about her life, keep to her life — no mention of the repository, branches, hooks, skills, specs, checks or anything else about how this works. Development talk only once she brings up development work herself, or runs /dev-mode.',
);
if (devLines.length) {
  lines.push(
    [
      'FOR THE DEVELOPER ONLY — do not raise in an everyday chat. Act on them silently where you can; if something she said could not be saved, tell her so in one plain line with no technical detail.',
      ...devLines.map((l) => `  ${l}`),
    ].join('\n'),
  );
}

context(input?.hook_event_name ?? 'SessionStart', lines.join('\n'));
