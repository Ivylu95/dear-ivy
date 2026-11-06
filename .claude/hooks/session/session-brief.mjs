// SessionStart — what a session must know before its first word, split by who it
// is for: the conversation, or the developer (held back unless she raises it).
//
// 1. A previous session could not save. Nothing else matters until that is true
//    again, so it is said first and in plain words.
// 2. Local commits that are not on the remote — the same failure, quieter.
// 3. (A session branch that never reached main is session/prune-branches.mjs's
//    to merge and to report, after its pass: DEP-006, DEP-011.)
// 4. data/PROFILE.yaml has a mandatory or recommended question still owed. The
//    owed ones are named here, with why each is empty, and first-contact asks
//    for them one at a time. A profile in the old flat shape is migrated first.
// 5. The record is still unwritten, so `first-contact` applies.
// 6. A copy with no GitHub repository yet is still being set up (the README's
//    download step, DEP-015): whoever is typing is setting it up, not the person
//    it is for, so 4 and 5 wait for her first conversation and `set-up` applies.
//    The same once it is on GitHub, for a copy made for someone else that no
//    profile question has reached, opened on a computer: the helper's session
//    between step 8 and her first conversation on the phone.
//
// Before 4 and 5 read anything, whatever of the record is missing is rebuilt
// blank (DAT-005) — so deleting data/ is a fresh start, not a broken session.
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

import { readHookInput, context, read, git, gitOk, gitMergeSigned, dataDir, realDataDir, existsFile, repoRoot, markerRead, markerWrite } from '../lib/hook.mjs';
import { SET_UP_LEARN_OWED } from '../lib/dev-reply.mjs';
import { inSandbox, isFreshStart, restoreMissing } from '../lib/sandbox.mjs';
import { readdirSync, statSync } from 'node:fs';
import { migrateIfLegacy, profilePath, record } from '../lib/profile.mjs';
import { runMigrations } from '../lib/migrations.mjs';
import { join, relative } from 'node:path';
import { CORE_DATA, readModules, timelineText } from '../lib/modules.mjs';
import { chatGaps, readList, thisChat, thisChatLine } from '../lib/chats.mjs';
import { crisisToday } from '../lib/new-chat-tip.mjs';
import { appointmentNotes } from '../lib/opening.mjs';

const FETCH_IS_FRESH_FOR = 10 * 60 * 1000;

function fetchedRecently() {
  try {
    // A FETCH_HEAD dated ahead of the clock is no fetch: it once stopped every fetch
    // until the clock caught up (round 3, B18).
    const age = Date.now() - statSync(join(repoRoot, '.git', 'FETCH_HEAD')).mtimeMs;
    return age >= 0 && age < FETCH_IS_FRESH_FOR;
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

if (existsFile(join(realDataDir, CORE_DATA, 'state', 'PUSH_FAILED.md'))) {
  devLines.push(
    'NOTE: a previous save could not reach GitHub (data/core/state/PUSH_FAILED.md says why). The save retries at every turn\'s end and the sync at this start, and the note clears itself once it lands; keep writing to the record as usual, and act only if a turn\'s end says it still cannot save.',
  );
}

// The commit gate (hooks/git/pre-commit, SFG-007). git keeps hook settings out
// of a clone, so every session points it back at the tracked folder.
if (git(['config', '--get', 'core.hooksPath']).trim() !== '.claude/hooks/git') {
  gitOk(['config', 'core.hooksPath', '.claude/hooks/git']);
}
// The Transcript's merge driver (.gitattributes, `merge=dialogue`), kept out of
// a clone the same way: without it two chats' clashing T-numbers stop every
// pull (2026-10-27). Only where dev/ is; a failure leaves git's own merge.
if (existsFile(join(repoRoot, 'ux', 'scripts', 'dialogue.mjs')) && existsFile(join(repoRoot, 'dev', 'dialogue'))) {
  try {
    (await import('../../../ux/scripts/dialogue.mjs')).setMergeDriver(repoRoot);
  } catch {}
}

if (!fetchedRecently()) git(['fetch', '-q', 'origin'], { timeout: 20000 });

// A session can open on a detached HEAD behind main (seen 2026-10-01): nothing
// written can be pushed, and every hook runs as it was before later fixes —
// one chat was measured against the wrong context window for a day. Where
// nothing can be lost (a clean tree, HEAD and any local main both already in
// origin/main), the checkout moves onto main; otherwise it stays, and warns.
//
// The same for a desk folder left on a chat's claude/ branch whose work is all
// in main (a chat pulled down to a desk): it moves back onto main, and the
// finished branch goes. Never in a cloud session, which the platform put on
// that branch and whose saves its git proxy may take there only; its disk can
// outlive a day, so age is no test (review, 2026-10-16).
const head0 = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const detached = head0 === 'HEAD';
const inCloud = Boolean(process.env.CLAUDE_CODE_REMOTE || process.env.CLAUDE_CODE_REMOTE_SESSION_ID);
const oldChat = !inCloud && head0.startsWith('claude/');
const clean = (detached || oldChat) && git(['status', '--porcelain']).trim() === '';
const inMain = (ref) => gitOk(['merge-base', '--is-ancestor', ref, 'origin/main']);
const noLocalMain = !gitOk(['rev-parse', '-q', '--verify', 'refs/heads/main']);
if (clean && inMain('HEAD') && (noLocalMain || inMain('main'))) {
  if (gitOk(noLocalMain ? ['switch', '-q', '-c', 'main', '--track', 'origin/main'] : ['switch', '-q', 'main'])) {
    gitOk(['merge', '-q', '--ff-only', 'origin/main']);
    if (oldChat) gitOk(['branch', '-q', '-d', head0]);
  }
}

// A new copy's main has no commit yet, and rev-parse cannot name an unborn branch.
const current = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim() || git(['symbolic-ref', '--short', '-q', 'HEAD']).trim();
const branch = current && current !== 'HEAD' ? current : null;
if (!branch) devLines.push('WARNING: the checkout is on a detached HEAD, so nothing written here can be pushed.');

// Never while a merge is under way: this merge would fail on it, and the abort
// below would then throw away someone else's half-resolved merge (2026-10-01).
const midMerge = gitOk(['rev-parse', '-q', '--verify', 'MERGE_HEAD']);
// A chat's own branch only: a person's branch is theirs to update, and a
// finished one left checked out is moved back onto main by prune-branches,
// which this merge would stop (review, 2026-10-16).
if (branch && branch.startsWith('claude/') && !midMerge && !gitOk(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'])) {
  // A copy with no name set cannot make the merge commit (review, 2026-10-16).
  const ident = git(['config', 'user.email']).trim() ? [] : ['-c', 'user.name=dear', '-c', 'user.email=dear@localhost'];
  // A fixed message: git's own names the branch, which a cloud chat takes from
  // its topic, and the commit gate refuses a name from the record (review, 2026-10-16).
  // Undone if it stops partway, and only if the merge is its own (round 32): an abort
  // whatever was there threw away another chat's merge begun in the same moment.
  if (!gitMergeSigned([...ident, 'merge', '-q', '--no-edit', '-m', 'merge: main into this session', 'origin/main'], 'origin/main')) {
    devLines.push(`WARNING: main could not be merged into ${branch} — this session may be missing what later sessions wrote.`);
  }
}

// On no remote branch at all: main just merged in is already saved, and is not counted.
// Nor is the merge commit that brought it in: it holds only what GitHub has (review, 2026-10-16).
const unpushed = Number(git(['rev-list', '--count', '--no-merges', 'HEAD', '--not', '--remotes=origin']).trim() || 0);
if (unpushed > 0 && gitOk(['remote', 'get-url', 'origin'])) devLines.push(
    branch
      ? `NOTE: ${unpushed} commit(s) here are on no GitHub branch yet. The save pushes them at this turn's end, and says so if it cannot; nothing to do by hand.`
      : // On no branch the save pushes only record work; anything else dies with this machine (review, 2026-10-16).
        `WARNING: ${unpushed} commit(s) on this detached checkout are on no GitHub branch, and the save will not push harness work from here. Bring them into main now: \`git switch main && git merge --no-edit <commit>\`, then push.`,
  );

// A session or rescue branch that never reached main is no longer checked here:
// session/prune-branches.mjs runs at the same moment, merges each into main,
// and hands on only one that conflicts (DEP-011). Checked here too, on refs
// fetched before that merge landed, it warned of a branch being merged in the
// same breath (review, 2026-10-16).

// DAT-005: a record that is missing, whole or in part, is rebuilt blank before
// anything reads it. After the merge above, so what main holds lands first and
// a blank file never collides with a real one arriving. Never over a file that
// exists. The Stop hook commits the result like any other record write.
// Not under the selftest (DEAR_RECORD_READONLY), whose cases must write nothing
// of the record: in a checkout without data/ it built 23 blank files there
// (found 2026-10-08, in the checkout CI's checks run in).
const restored = process.env.DEAR_RECORD_READONLY === '1' ? [] : restoreMissing(dataDir);
if (restored.length) {
  const rel = relative(repoRoot, dataDir).replace(/\\/g, '/');
  const probe = `${rel}/${restored[0]}`;
  const last = git(['rev-list', '-1', 'HEAD', '--', probe]).trim();
  // The last commit touching a deleted file is the deletion; its parent holds it.
  const held = last && (gitOk(['cat-file', '-e', `${last}:${probe}`]) ? last : `${last}^`);
  const shown = restored.slice(0, 6).join(', ') + (restored.length > 6 ? `, and ${restored.length - 6} more` : '');
  // What the developer's checkout brings back. The whole folder only when that overwrites
  // nothing but blanks: with one page lost, `-- data` put every other page back to that
  // old commit, so whatever was written since went from the record, and an edit not yet
  // saved went for good (round 34). Otherwise only what is blank or missing here is named.
  let restoreSpec = rel;
  if (held) {
    const blank = new Set(restored.map((p) => `${rel}/${p}`));
    const inHeld = git(['ls-tree', '-r', '-z', '--name-only', held, '--', `${rel}/`]).split('\0').filter(Boolean);
    const held1 = new Set(inHeld);
    // A page here that differs from that commit's, tracked or not: the checkout would overwrite it.
    const differs = git(['diff', '--name-only', '-z', held, '--', `${rel}/`]).split('\0').filter(Boolean);
    const untracked = git(['ls-files', '-o', '-z', '--', `${rel}/`]).split('\0').filter(Boolean);
    const overwrites = [...differs, ...untracked].some((p) => held1.has(p) && !blank.has(p) && existsFile(join(repoRoot, p)));
    if (overwrites) restoreSpec = inHeld.filter((p) => blank.has(p) || !existsFile(join(repoRoot, p))).map((p) => `"${p}"`).join(' ') || `"${rel}/${restored[0]}"`;
  }
  // A standing file an update added is not a fresh start (isFreshStart).
  if (!isFreshStart(restored, held)) {
    devLines.push(`RECORD GREW (DAT-005): ${restored.length} new standing file(s) an update added were created blank in ${rel}/: ${shown}. The rest of the record is untouched; carry on as usual.`);
  } else {
    // The commit is for the developer to act on, never the session: a rebuild is a
    // fresh start (DAT-005), so the old record is not read, restored or quoted.
    devLines.push(
      `RECORD REBUILT (DAT-005): ${restored.length} file(s) were missing from ${rel}/ and were created blank: ${shown}.` +
        (held
          ? ` The last commit holding them is ${held.slice(0, 12)}${held.endsWith('^') ? '^' : ''}; if the deletion was an accident, the developer — not this session — runs \`git checkout ${held.slice(0, 12)}${held.endsWith('^') ? '^' : ''} -- ${restoreSpec}\`.`
          : ' Nothing in git history held them, so this is a first start.') +
        ' Treat the blank files as the whole record: never read, restore or mention anything from git history, and open as a first conversation.',
    );
  }
}

// The profile, read through the one schema every other reader uses
// (lib/profile-schema.mjs, via lib/profile.mjs; no dependencies). A record still in
// the old flat shape is migrated first, the old file kept in archive/.
const migrated = migrateIfLegacy(dataDir);
if (migrated) {
  lines.push(
    `PROFILE MIGRATED: ${relative(repoRoot, dataDir)}/PROFILE.yaml was rewritten in the three-section shape; the old file is at ${relative(repoRoot, migrated)}. Nothing to say to her about it.`,
  );
}
// Then every record migration this record has not had yet (.claude/migrations/,
// PRD-008 design 2), each superseded file kept in archive/migrations/ first.
// Prints; never blocks: a runner that throws is reported, never fatal.
// Not under the selftest (DEAR_RECORD_READONLY), as restoreMissing above: it runs this
// brief on the live repository from every session start and every harness commit's
// gate, beside the session's own start and its save (round 45).
const moved = process.env.DEAR_RECORD_READONLY === '1'
  ? { ran: [], archived: [], problems: [] }
  : await runMigrations(dataDir).catch((e) => ({ ran: [], archived: [], problems: [e.message] }));
if (moved.archived.length) {
  const rel = relative(repoRoot, dataDir).replace(/\\/g, '/');
  lines.push(
    `RECORD MIGRATED: ${moved.ran.join(', ')} rewrote ${moved.archived.map((a) => `${rel}/${a.file}`).join(', ')} in the current shape; each old file is in ${rel}/archive/migrations/. Nothing to say to her about it.`,
  );
}
if (moved.problems.length) {
  devLines.push(`MIGRATION HELD: ${moved.problems.slice(0, 3).join('; ')}. The record was left as it was; the next session start tries again.`);
}
const profileText = read(profilePath(dataDir));
const profile = record.readProfile(profileText);
if (profileText && profile.errors.length) {
  lines.push(
    [
      `PROFILE INVALID: ${relative(repoRoot, dataDir)}/PROFILE.yaml breaks its rules. Fix it before writing anything else to it (the rules are in its header):`,
      ...profile.errors.slice(0, 10).map((e) => `  - ${e}`),
    ].join('\n'),
  );
}

// 6: no origin means the copy has not reached GitHub, so it is not hers to talk in yet.
const newCopy = !gitOk(['remote', 'get-url', 'origin']);
if (newCopy) {
  lines.push(
    'NEW COPY, NOT SET UP YET: this copy has no GitHub repository, so whoever is typing is setting it up, not the person it is for. The set-up skill applies (new copy mode), in plain words, one step per message; even a greeting gets one plain line saying the copy is not set up yet and offering to set it up. Ask no profile question here: first contact waits for her first conversation, once setup has reached that step.',
  );
}

const now = record.zonedDateTime(new Date(), profile.value.timezone ?? 'UTC');
const owed = record.owedQuestions(profile.questions, now.slice(0, 10));

// 6b: a copy made for someone else, on GitHub since step 8, with no profile question
// ever asked, opened on a computer rather than in a cloud session: the helper's own
// session, between step 8's push and her first conversation, which happens on her phone
// (new-copy-close.md step 12). Step 8's origin once ended NEW COPY here, and the brief told
// the helper's chat to load first-contact (round 2, D2).
const setupNotes = read(join(dataDir, CORE_DATA, 'state', 'setup_notes.md'));
// Only a profile that reads, with its questions, can show nothing was asked: every() of
// none is true, and an unreadable profile once read as the helper's (round 3, C14). A
// cloud session is told as the doctor tells it, Remote Control's included; and a record
// that has logged a session of hers is past the handover.
const neverAsked = Boolean(profileText) && !profile.errors.length && Object.keys(profile.questions ?? {}).length > 0 &&Object.values(profile.questions).every((q) => q.status === 'not_asked');
const anyCloud = inCloud || Boolean(process.env.CLAUDE_CODE_REMOTE_SDK_URL || process.env.CCR_AGENT_PROXY_ENABLED);
const sessionLogged = /^\|\s*\d{4}-\d{2}-\d{2} · session /m.test(read(join(dataDir, CORE_DATA, 'state', 'log.md')));
const helperSession = !newCopy && !anyCloud && !sessionLogged && /^- for · someone else\s*$/m.test(setupNotes) && neverAsked;
if (helperSession) {
  lines.push(
    'SETUP NOT YET HANDED OVER: this copy is for someone else, no profile question has been asked yet, and this session is on a computer, not her phone, so whoever is typing is most likely the person setting it up (new-copy-finish.md, steps 8 to 11). The set-up skill applies; ask them no profile question: first contact waits for her first conversation (step 12). If the person typing says it is the one it is for, first-contact applies as usual.',
  );
}
const settingUp = newCopy || helperSession;
const note = ({ status, status_reason, last_updated }) =>
  status === 'asked'
    ? ` [ASKED BEFORE ${last_updated}${status_reason ? `: ${status_reason}` : ''}. Say so ("last time I asked…"); never "I haven't asked"]`
    : status === 'removed'
      ? ` [REMOVED ${last_updated}. Answered once and taken out; never "I never asked", never the old answer]`
      : '';
const mandatory = owed.filter((q) => q.section === 'mandatory');
const recommended = owed.filter((q) => q.section === 'recommended');
if (owed.length && !settingUp) {
  lines.push(
    [
      `PROFILE INCOMPLETE: ${relative(repoRoot, dataDir)}/PROFILE.yaml has ${mandatory.length} mandatory and ${recommended.length} recommended question(s) still owed. Load first-contact. If she arrives with something to say, hear it first and ask at the first natural pause (A-144); otherwise mandatory first; then recommended, which can wait for a pause if she arrives with something on her mind. ONE per message, each with its reason and her permission. As you ask one, set status: asked; as she answers, status: answered with her words in value. Every change sets last_updated to now (${now}) and is checked the moment it is saved.`,
      ...mandatory.map((q) => `  - mandatory.${q.key}: ${record.QUESTIONS[q.key].describe}${note(q)}`),
      ...recommended.map((q) => `  - recommended.${q.key}: ${record.QUESTIONS[q.key].describe}${note(q)}`),
      'A "not now" or "check back another time": keep status asked and set ask_after to a date two weeks on, or the one she names; the brief stays quiet about it until then. Anything she would rather not answer: status declined, with revisit_when saying what would make it matter again; asked again only when that comes up. Crisis outranks all of this: if she is unsafe, stop asking.',
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

// A chat for each lasting part of her life (card A-158): which chat this is, and an area
// she uses that has none, to offer once. Never while setting up, never on a crisis day.
if (!settingUp) {
  const list = readList(dataDir);
  const here = thisChat(list, process.env.CLAUDE_CODE_REMOTE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID);
  const others = list.chats.filter((c) => c !== here && c.kind === 'everyday' && c.state === 'open');
  if (list.chats.length) {
    lines.push(
      here
        ? thisChatLine(here, others)
        : 'THIS CHAT (A-158) is not on her chat list yet: once she says what it is for, add it (the chats skill), never asking her to.',
    );
  }
  const gaps = crisisToday(read(join(dataDir, CORE_DATA, 'state', 'log.md')), now.slice(0, 10)) ? [] : chatGaps(readModules(repoRoot), dataDir, list);
  if (gaps.length) {
    lines.push(
      [
        'A CHAT TO OFFER (A-158), once, at a calm natural pause, never on a hard day or in a crisis, after anything she came with and after any profile question; one per session at most. Load the chats skill:',
        ...gaps.map((g) => `  - ${g.module}: ${g.emoji} ${g.title}, for ${g.for}`),
      ].join('\n'),
    );
  }
}

// A rule for everyone written into her record instead of the harness (card A-163): told to
// the developer only, never to her. Only where the developer's half is, as the check is.
if (existsFile(join(repoRoot, 'ux', 'scripts', 'record-rules.mjs')) && existsFile(join(repoRoot, 'dev'))) {
  try {
    const { findings, readReviewed } = await import('../../../ux/scripts/record-rules.mjs');
    const found = findings(dataDir, readReviewed());
    if (found.length) devLines.push(`RULES IN HER RECORD (A-163): ${found.length} line(s) read like a rule for everyone, or are template text left unfilled (${[...new Set(found.map((f) => f.file))].slice(0, 3).join(', ')}). Run: node ux/scripts/record-rules.mjs check; move each rule to the harness, or review to keep it as hers.`);
  } catch {}
}

// What she meant to tell her therapist, the day before the appointment and the day
// of, found in calendar.md or her Google Calendar copy (lib/opening.mjs).
// Kept but raised only when she mentioned the appointment was as good as lost
// (T-330). Her own chat only, in her words; the check-in's phone message says no
// more than that something waits (ux/scripts/reminders.mjs send-due).
const waiting = settingUp
  ? null
  : appointmentNotes({
      loops: read(join(dataDir, CORE_DATA, 'state', 'open_loops.md')),
      calendar: read(join(dataDir, CORE_DATA, 'calendar', 'calendar.md')),
      google: read(join(dataDir, CORE_DATA, 'calendar', 'google.json')),
      today: now.slice(0, 10),
      timeZone: profile.value.timezone ?? 'UTC',
    });
if (waiting) {
  lines.push(
    [
      `BEFORE HER APPOINTMENT ${waiting.when.toUpperCase()} (${waiting.date}): what she meant to tell her therapist is waiting in open_loops.md, in her words:`,
      ...waiting.items.map((i) => `  - ${i}`),
      'Hear what she came with first; then, once, at a natural point, read these back in her words so she has them ready (therapy:appointment). Never as an opener over something she brought, never in a crisis, and not again once she has seen them.',
    ].join('\n'),
  );
}

// Nothing she has lived through is on the record yet: no dated line on the
// timeline and no journal entry. Not the about_me sentinel alone, which the
// first clinical fact she mentions removes, long before she has talked about
// anything (so the "everything answered, nothing on record yet" opening never
// fired). The sentinel still counts, for a record with no timeline at all, and only
// then: an import fills the timeline and may leave the sentinel, and the brief once
// said "nothing she has lived through is on the record yet" over a whole imported
// record (round 2, B14).
// A split timeline's year files count too (D14).
const timelineEmpty = !/^\d{4}-\d{2}-\d{2} /m.test(timelineText(dataDir, read));
const journalEmpty = (() => {
  try {
    return !readdirSync(join(dataDir, CORE_DATA, 'journal')).some((f) => /^\d{4}-\d{2}-\d{2}/.test(f));
  } catch {
    return true;
  }
})();
if (!settingUp && timelineEmpty && (read(join(dataDir, CORE_DATA, 'me', 'about_me.md')).includes('<!-- unfilled:') || journalEmpty)) {
  lines.push(
    owed.length
      ? 'FIRST CONTACT: nothing she has lived through is on the record yet. The first-contact skill applies for the opening, then one open question. Beyond the profile, ask on a need-to-know basis only.'
      : 'FIRST CONTACT, PROFILE DONE: every question is answered but nothing she has lived through is on the record yet. Use first-contact\'s "everything answered, nothing else on record yet" opening: no questions, hand her the lead.',
  );
}

// A gap in what is known about her (card A-180): the one that matters most, at most one a
// day, in an everyday chat only, never on a hard day or late at night, never while a profile
// question is owed or on a first contact (lib/gaps.mjs holds the rest of the gates).
if (!settingUp && !lines.some((l) => l.startsWith('FIRST CONTACT'))) {
  try {
    const sid = process.env.CLAUDE_CODE_REMOTE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || input?.session_id || '';
    let dev = thisChat(readList(dataDir), sid)?.kind === 'development';
    if (!dev) dev = (await import('../lib/dev-mode.mjs')).devModeActive(input ?? {});
    const { briefGap } = await import('../lib/gaps.mjs');
    const gap = briefGap({ dataDir, local: now, session: sid, everyday: !dev, profileOwed: owed.length });
    if (gap.line) lines.push(gap.line);
  } catch {}
}

// Last, so it lands first: the reader must know which record every line above
// was read from before trusting any of it.
if (inSandbox()) {
  lines.unshift(
    'ACTIVE RECORD: data-sandbox/ — this chat is a test. Read every `data/` in CLAUDE.md, the skills and the specs as `data-sandbox/`, and never read or write data/. Crisis handling is never sandboxed.',
  );
}

// Always said, because the default is the thing most easily forgotten: a chat
// is everyday until she makes it about the system. Not in a new copy, where
// nobody's everyday has begun and the chat is its setup. A helper's session after
// step 8 keeps it: if she is the one typing, her chat stays hers.
if (!newCopy) lines.push(
  'EVERYDAY UNLESS SHE SAYS OTHERWISE: if she opens with a greeting or anything about her life, keep to her life — no mention of the repository, branches, hooks, skills, specs, checks or anything else about how this works. Development talk only once she brings up development work herself, or runs /dev-mode; a plain request for development work switches development mode on without asking (.claude/commands/dev-mode.md). Asking in plain words to save or upload is not development work (CON-013): do it silently and answer in one plain line ("it is saved"), or, if it could not be done, one plain line saying so — never steps, files, counts or a to-do list.',
);
// DEP-014: a set-up run that closed its chat without its learning step, which the
// Stop check could not raise on a next message (dev-reply-check.mjs). Said once.
const learnOwed = markerRead(SET_UP_LEARN_OWED).trim();
if (learnOwed) {
  devLines.push(`SET-UP LEARNING STEP OWED: ${learnOwed}`);
  markerWrite(SET_UP_LEARN_OWED, '');
}
if (devLines.length) {
  lines.push(
    [
      'FOR THE DEVELOPER ONLY — do not raise in an everyday chat. Act on them silently where you can; if something she said could not be saved, tell her so in one plain line with no technical detail.',
      ...devLines.map((l) => `  ${l}`),
    ].join('\n'),
  );
}

context(input?.hook_event_name ?? 'SessionStart', lines.join('\n'));
