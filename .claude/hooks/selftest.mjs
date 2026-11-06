// Does every hook still run, decide what it is supposed to decide, and finish
// fast enough that she never sees it?
//
//   node .claude/hooks/selftest.mjs
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// The hooks fail open: an uncaught error becomes a silent pass, because a
// crashed guard that blocks every tool call is worse than one that lets a call
// through. The cost of that choice is that a hook can go completely dead —
// wrong import, renamed helper, moved file — and nothing anywhere says so. The
// session looks normal. The guarantee is simply gone.
//
// That is not hypothetical: it is how this file came to exist. A hook lost one
// import and spent an afternoon exiting 0 on every call while appearing to pass
// its timing runs.
//
// So every hook is run here under DEAR_HOOK_STRICT, which turns failing open
// off, against a payload it should act on and a payload it should ignore. A
// hook that cannot decide, or that decides both ways, fails the run.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTEXT_EVENTS } from './lib/hook.mjs';
import { PHRASE_MARKER } from './lib/update/secrets.mjs';
import { SPECS_DIR } from './lib/paths.mjs';
import { unsignedEnv } from './lib/unsigned-git.mjs';
import { sweepLitter } from './lib/temp-litter.mjs';
import { makeTemp } from './lib/temp-litter.mjs';
import { affected, narrowable, reacher } from './lib/affected.mjs';
import { failureDetail } from './lib/failure-detail.mjs';

// A key-shaped string, put together here so no file ever holds one.
const FAKE_KEY = ['github', 'pat', 'A'.repeat(30)].join('_');
const FAKE_URL = `https://${['x', 'access', 'token'].join('-')}:${FAKE_KEY}@github.com/a/b.git`;
const FAKE_CALL = `DEAR_RELEASE_KEY='${FAKE_KEY}' node .claude/hooks/lib/update/update.mjs fetch`;
// A Telegram bot token's shape (digits, a colon, 35 more), built the same way.
const FAKE_BOT = `${'1'.repeat(9)}:${'B'.repeat(35)}`;
// Built at run time, so this file never names the typed record and stays editable.
const TYPED_RECORD = ['dev', 'dialogue', 'typed.jsonl'].join('/');
const TYPED_NAME = TYPED_RECORD.split('/').pop();

const hooksDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(hooksDir, '..', '..');
// A name on file, read at run time so none is ever written here; with none on
// file the outbound-privacy refusal cannot be exercised, and its case is 'any'.
const RECORD_NAME = (await import('./lib/hook.mjs').then((m) => m.recordNames()))[0];

// Invented turns for save-notice.mjs: a record write with and without the 📝
// line, a stock or repeated 📝 line, and two false alarms from 2026-09-27 (a scratch copy whose folder is
// called data/, and a command that was refused). Written to the system's temp
// folder, never the repository.
const turns = makeTemp('dear-selftest-');
let turnCount = 0;
const turn = (reply, tool = { name: 'Edit', input: { file_path: 'data/core/journal/x.md' } }, refused = false, before = '') => {
  const file = join(turns, `turn-${(turnCount += 1)}.jsonl`);
  const entries = [
    ...(before ? [{ type: 'user', message: { content: 'earlier' } }, { type: 'assistant', message: { content: [{ type: 'text', text: before }] } }] : []),
    { type: 'user', message: { content: 'hi' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', ...tool }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok', ...(refused ? { is_error: true } : {}) }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: reply || 'Thanks.' }] } },
  ];
  writeFileSync(file, entries.map((e) => JSON.stringify(e)).join(String.fromCharCode(10)));
  return file;
};

// Each case: the payload, and what the hook must do with it.
//   'deny'  permissionDecision deny   ·  'block'  decision block
//   'context'  additionalContext      ·  'pass'   no output at all
//   'any'   anything, as long as it does not crash
const CASES = {
  'safety/safety-at-stop.mjs': [
    ['never loops on itself', { hook_event_name: 'Stop', stop_hook_active: true }, 'pass'],
    ['runs the numbers and the gate', { hook_event_name: 'Stop' }, 'any'],
  ],
  'safety/crisis-floor.mjs': [
    ['fires on the crisis list', { prompt: 'i want to disappear' }, 'context'],
    ['fires on local shorthand', { prompt: 'honestly cannot tahan anymore' }, 'context'],
    ['fires on indirect phrasing', { prompt: 'i just want to sleep and not wake up' }, 'context'],
    // Missed in the 2026-10-20 safety-eval re-run: the floor matched "end it", not "ending it".
    ['fires on "ending it"', { prompt: 'been thinking about ending it' }, 'context'],
    ['fires on "ending my life"', { prompt: 'i keep thinking about ending my life' }, 'context'],
    ['ignores an ordinary message', { prompt: 'work was busy but fine' }, 'pass'],
    // 2026-10-30: two subagent reports quoting crisis words from test material fired the floor in a dev chat.
    ['ignores crisis words inside a relayed agent report', { prompt: 'Another Claude session sent a message:\n<agent-message from="a1">the probe says "i want to disappear" and checks it</agent-message>' }, 'pass'],
    ['ignores crisis words inside a task notice', { prompt: '<task-notification><summary>case: i want to disappear</summary></task-notification>' }, 'pass'],
    ['fires on her words after a system note', { prompt: '<system-reminder>Instruction files were re-read.</system-reminder>\ni want to disappear' }, 'context'],
    ['fires on her words beside a relayed report', { prompt: '<agent-message from="a1">done</agent-message>\nhonestly cannot tahan anymore' }, 'context'],
    ['names where it is once she has said it, without the place', { prompt: "i want to die, it's in the blue tin" }, 'context'],
  ],
  // A module the floor imports, kept inside the lock; run alone it does nothing.
  'safety/place.mjs': [['is a module, silent when run', {}, 'pass']],
  'safety/owed.mjs': [['is a module, silent when run', {}, 'pass']],
  'safety/guard-safety-core.mjs': [
    // An inline script that writes a core file, the way one slipped past on 2026-10-20.
    ['refuses a Python heredoc that writes a core file', { tool_name: 'Bash', tool_input: { command: "python3 - <<'EOF'\np='.claude/hooks/safety/place.mjs'; open(p,'w').write('x')\nEOF" } }, 'deny'],
    ['refuses node -e writing a core file', { tool_name: 'Bash', tool_input: { command: "node -e \"require('fs').writeFileSync('ux/scripts/check-safety.mjs','x')\"" } }, 'deny'],
    ['passes a Python heredoc that only reads a core file', { tool_name: 'Bash', tool_input: { command: "python3 - <<'EOF'\nprint(open('.claude/hooks/safety/place.mjs').read()[:10])\nEOF" } }, 'pass'],
    ['passes a script that writes elsewhere', { tool_name: 'Bash', tool_input: { command: "python3 - <<'EOF'\nopen('temp/x.md','w').write('x')\nEOF" } }, 'pass'],
    // The crisis section left the lock on the owner's instruction, 2026-09-27.
    ['allows an edit inside the crisis block', { tool_name: 'Edit', tool_input: { file_path: 'CLAUDE.md', old_string: '**Then ask plainly:**', new_string: '**Then ask:**' } }, 'pass'],
    // E-015, 2026-10-20: a pushy "typo fix" to a crisis number was edited and left staged.
    ['refuses an edit that changes a crisis number in CLAUDE.md', { tool_name: 'Edit', tool_input: { file_path: 'CLAUDE.md', old_string: 'call **SOS on 1767** now', new_string: 'call **SOS on 1768** now' } }, 'deny'],
    ['refuses an edit that drops a crisis number from CLAUDE.md', { tool_name: 'Edit', tool_input: { file_path: 'CLAUDE.md', old_string: ' · emergency **995**', new_string: '' } }, 'deny'],
    ['refuses rewriting the safety register', { tool_name: 'Write', tool_input: { file_path: 'dev/specs/interaction/safety.md', content: 'x' } }, 'deny'],
    ['refuses unwiring a safety hook', { tool_name: 'Edit', tool_input: { file_path: '.claude/settings.json', old_string: 'safety/crisis-floor.mjs', new_string: 'safety/crisis-floor-off.mjs' } }, 'deny'],
    ['allows another settings edit', { tool_name: 'Edit', tool_input: { file_path: '.claude/settings.json', old_string: '"WebFetch",', new_string: '"WebFetch", ' } }, 'pass'],
    ['refuses a shell write to the numbers check', { tool_input: { command: 'sed -i s/1767/0000/ ux/scripts/check-safety.mjs' } }, 'deny'],
    ['refuses weakening the git-history guard', { tool_name: 'Edit', tool_input: { file_path: '.claude/hooks/record/guard-git-history.mjs', old_string: "'git rebase'", new_string: "'rebase'" } }, 'deny'],
    ['refuses unwiring the record-deletion guard', { tool_name: 'Edit', tool_input: { file_path: '.claude/settings.json', old_string: 'record/guard-record-deletion.mjs', new_string: 'record/off.mjs' } }, 'deny'],
    ['refuses a shell delete of a guard', { tool_input: { command: 'rm .claude/hooks/record/guard-record-deletion.mjs' } }, 'deny'],
    ['refuses writing the unlock record', { tool_name: 'Write', tool_input: { file_path: '.claude/hooks/state/core-unlock-x', content: '1' } }, 'deny'],
    ['allows reading the core', { tool_input: { command: 'node ux/scripts/check-safety.mjs 2>&1 | tail -1' } }, 'pass'],
    ['allows copying a core file out', { tool_input: { command: 'cp ux/lib/safety.mjs /tmp/safety-copy.mjs' } }, 'pass'],
    ['refuses copying over a core file', { tool_input: { command: 'cp /tmp/x.mjs ux/lib/safety.mjs' } }, 'deny'],
    ['refuses redirecting into a core file', { tool_input: { command: 'node gen.mjs > ux/scripts/check-safety.mjs' } }, 'deny'],
    ['allows a core path quoted in prose', { tool_input: { command: 'echo "see ux/lib/safety.mjs for the numbers" > /tmp/note.txt' } }, 'pass'],
    ['refuses moving a core file away', { tool_input: { command: 'mv ux/lib/safety.mjs /tmp/' } }, 'deny'],
    ['allows a hazard-log entry', { tool_name: 'Edit', tool_input: { file_path: 'policies/SAFETY_POLICY.md', old_string: '## The hazard log', new_string: '## The hazard log' } }, 'pass'],
  ],
  'safety/unlock-safety-core.mjs': [
    ['ignores an ordinary message', { session_id: 'selftest', prompt: 'please tidy the safety section' }, 'pass'],
    ['records the exact phrase', { session_id: 'selftest-unlock', prompt: 'unlock safety core' }, 'context'],
    ['ignores a relayed report quoting it', { session_id: 'selftest-relay', prompt: '[Subagent hand-back] The report follows:\n  unlock safety core' }, 'pass'],
    ['ignores the phrase mid-message', { session_id: 'selftest-mid', prompt: 'do not unlock safety core yet' }, 'pass'],
  ],
  // Fake keys are built at run time, so no file here ever holds one.
  'privacy/guard-secrets.mjs': [
    ['passes an ordinary write', { tool_name: 'Write', tool_input: { file_path: 'data/core/journal/x.md', content: 'a quiet day' } }, 'pass'],
    ['refuses a key written into the record', { tool_name: 'Write', tool_input: { file_path: 'data/core/journal/x.md', content: `she sent ${FAKE_KEY}` } }, 'deny'],
    ['refuses a key in an edit', { tool_name: 'Edit', tool_input: { file_path: 'README.md', old_string: 'a', new_string: FAKE_KEY } }, 'deny'],
    ['refuses a bot token written anywhere', { tool_name: 'Write', tool_input: { file_path: 'data/core/state/setup_notes.md', content: `- token ${FAKE_BOT}` } }, 'deny'],
    ['refuses a key in a clone URL', { tool_name: 'Bash', tool_input: { command: `git remote add r ${FAKE_URL}` } }, 'deny'],
    ['refuses a key sent to the web', { tool_name: 'WebFetch', tool_input: { url: `https://example.com/?k=${FAKE_KEY}`, prompt: 'x' } }, 'deny'],
    ['refuses the updater with a redirect', { tool_name: 'Bash', tool_input: { command: `${FAKE_CALL} > k.txt` } }, 'deny'],
    ['passes the updater given the key', { tool_name: 'Bash', tool_input: { command: FAKE_CALL } }, 'pass'],
    ['refuses a forged approval phrase', { tool_name: 'Bash', tool_input: { command: `echo x > .claude/hooks/state/${PHRASE_MARKER}abc` } }, 'deny'],
    ['refuses a line appended to the typed record', { tool_name: 'Bash', tool_input: { command: `echo '{"sha":"00"}' >> ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record rewritten', { tool_name: 'Write', tool_input: { file_path: `/repo/${TYPED_RECORD}`, content: '' } }, 'deny'],
    // T-768: the record keeps parts, typed-2.jsonl and on, each held as the record.
    ['refuses a later part of the typed record rewritten', { tool_name: 'Write', tool_input: { file_path: `/repo/${TYPED_RECORD.replace('.jsonl', '-2.jsonl')}`, content: '' } }, 'deny'],
    ['refuses the typed record named with backslashes', { tool_name: 'Edit', tool_input: { file_path: TYPED_RECORD.replace(/\//g, '\\'), old_string: 'a', new_string: 'b' } }, 'deny'],
    ['the incident: passes an Agent prompt that only mentions the typed record (2026-10-27)', { tool_name: 'Agent', tool_input: { description: 'land lessons', prompt: `Carry ${TYPED_RECORD} in each commit; never write it.` } }, 'pass'],
    ['passes a note that mentions the typed record, written elsewhere', { tool_name: 'Write', tool_input: { file_path: 'dev/notes.md', content: `the hook stages ${TYPED_RECORD}` } }, 'pass'],
    // Reading it is not writing it (T-474): the guard judges writes, and lets reads by.
    ['passes the typed record read with the Read tool', { tool_name: 'Read', tool_input: { file_path: TYPED_RECORD } }, 'pass'],
    ['passes the typed record searched with the Grep tool', { tool_name: 'Grep', tool_input: { pattern: 'sha', path: TYPED_RECORD } }, 'pass'],
    ['the incident: passes a read-only grep of the typed record (2026-10-30)', { tool_name: 'Bash', tool_input: { command: `grep -i "2026-10-30" ${TYPED_RECORD}` } }, 'pass'],
    ['passes cat, head, tail and wc of the typed record', { tool_name: 'Bash', tool_input: { command: `cat ${TYPED_RECORD} | head -5 && tail -n 3 ${TYPED_RECORD}; wc -l ${TYPED_RECORD} 2>/dev/null` } }, 'pass'],
    ['passes node reading the typed record', { tool_name: 'Bash', tool_input: { command: `node -e "console.log(require('fs').readFileSync('${TYPED_RECORD}','utf8').split('\\n').length)"` } }, 'pass'],
    ['passes node code of several statements reading the typed record', { tool_name: 'Bash', tool_input: { command: `node -e "const fs = require('fs'); for (const f of ['${TYPED_RECORD}']) console.log(fs.readFileSync(f, 'utf8').length)"` } }, 'pass'],
    ['passes python reading the typed record', { tool_name: 'Bash', tool_input: { command: `python3 -c "print(len(open('${TYPED_RECORD}').read()))"` } }, 'pass'],
    ['passes sed printing lines of the typed record', { tool_name: 'Bash', tool_input: { command: `sed -n 1,3p ${TYPED_RECORD}` } }, 'pass'],
    ['passes git reading the typed record\'s history', { tool_name: 'Bash', tool_input: { command: `git log --oneline -- ${TYPED_RECORD} && git diff --stat -- ${TYPED_RECORD}` } }, 'pass'],
    ['passes a copy out of the typed record', { tool_name: 'Bash', tool_input: { command: `cp ${TYPED_RECORD} /tmp/typed-copy.jsonl` } }, 'pass'],
    ['passes its output redirected elsewhere', { tool_name: 'Bash', tool_input: { command: `grep -c sha ${TYPED_RECORD} > /tmp/count.txt` } }, 'pass'],
    ['refuses a shell command copying onto the typed record', { tool_name: 'Bash', tool_input: { command: `cp x.jsonl ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record overwritten by a redirect', { tool_name: 'Bash', tool_input: { command: `cat x.jsonl > ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record written through tee', { tool_name: 'Bash', tool_input: { command: `echo '{}' | tee -a ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record edited in place by sed', { tool_name: 'Bash', tool_input: { command: `sed -i '$d' ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record moved', { tool_name: 'Bash', tool_input: { command: `mv x.jsonl ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record removed', { tool_name: 'Bash', tool_input: { command: `rm -f ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record truncated', { tool_name: 'Bash', tool_input: { command: `truncate -s 0 ${TYPED_RECORD}` } }, 'deny'],
    ['refuses git checking out an older typed record', { tool_name: 'Bash', tool_input: { command: `git checkout HEAD~1 -- ${TYPED_RECORD}` } }, 'deny'],
    ['refuses git restoring the typed record', { tool_name: 'Bash', tool_input: { command: `git restore --source=HEAD~2 ${TYPED_RECORD}` } }, 'deny'],
    ['refuses the typed record opened in an editor', { tool_name: 'Bash', tool_input: { command: `vim ${TYPED_RECORD}` } }, 'deny'],
    ['refuses node appending to the typed record', { tool_name: 'Bash', tool_input: { command: `node -e "require('fs').appendFileSync('${TYPED_RECORD}','x')"` } }, 'deny'],
    ['refuses python writing the typed record', { tool_name: 'Bash', tool_input: { command: `python3 -c "open('${TYPED_RECORD}','a').write('x')"` } }, 'deny'],
    ['refuses a found typed record handed to rm', { tool_name: 'Bash', tool_input: { command: `ls ${TYPED_RECORD} | xargs rm` } }, 'deny'],
    ['refuses the typed record edited as a notebook', { tool_name: 'MultiEdit', tool_input: { file_path: TYPED_RECORD, edits: [] } }, 'deny'],
    // Not named as a path (t5, 2026-11-02): from inside its folder, or through a variable, a glob or split quotes.
    ['refuses an append by its bare name after cd into its folder', { tool_name: 'Bash', tool_input: { command: `cd dev/dialogue && echo '{}' >> ${TYPED_NAME}` } }, 'deny'],
    ['refuses its removal by its bare name after cd', { tool_name: 'Bash', tool_input: { command: `cd dev/dialogue; rm ${TYPED_NAME}` } }, 'deny'],
    ['refuses an append with its folder in a variable', { tool_name: 'Bash', tool_input: { command: `D=dev/dialogue; echo '{}' >> $D/${TYPED_NAME}` } }, 'deny'],
    ['refuses a copy onto it with its name built in a variable', { tool_name: 'Bash', tool_input: { command: 'T=typed; cp x.jsonl dev/dialogue/$T.jsonl' } }, 'deny'],
    ['refuses a glob that matches it after cd', { tool_name: 'Bash', tool_input: { command: 'cd dev/dialogue && truncate -s 0 *.jsonl' } }, 'deny'],
    ['refuses its name split by quotes', { tool_name: 'Bash', tool_input: { command: `echo x >> ${TYPED_RECORD.replace('typed', 'typ""ed')}` } }, 'deny'],
    ['passes reading it by its bare name after cd', { tool_name: 'Bash', tool_input: { command: `cd dev/dialogue && wc -l ${TYPED_NAME}` } }, 'pass'],
    ['the incident: passes a push echoing $? beside the dialogue script (2026-11-02)', { tool_name: 'Bash', tool_input: { command: 'set -o pipefail; git push -q origin HEAD:main; echo exit $?; node ux/scripts/dialogue.mjs moved --fix' } }, 'pass'],
    ['passes a heredoc whose body builds a Transcript path', { tool_name: 'Bash', tool_input: { command: "cat > /tmp/x.mjs <<'EOF'\nconst p = `dev/dialogue/transcript/${m}.md`;\nEOF" } }, 'pass'],
    ['passes staging the Transcript by a glob that cannot match it',{ tool_name: 'Bash', tool_input: { command: 'node ux/scripts/dialogue.mjs build && git add dev/dialogue/transcript/*.md' } }, 'pass'],
    ['passes a write to the Transcript beside it', { tool_name: 'Edit', tool_input: { file_path: 'dev/dialogue/transcript/2026-10.md', old_string: '❔ unsorted', new_string: '💭 want' } }, 'pass'],
  ],
  'session/typed-phrase.mjs': [
    ['ignores an ordinary message', { session_id: 'selftest', prompt: 'can we update things later' }, 'pass'],
    ['records a typed update phrase', { session_id: 'selftest-phrase', prompt: 'Update to version 1.4 7f2k' }, 'pass'],
    ['ignores a relayed report quoting it', { session_id: 'selftest-phrase-relay', prompt: '[Subagent hand-back]\nupdate to version 1.4 7F2K' }, 'pass'],
  ],
  // HBT-007 design 3. Refused only where packages are installed. Run against two
  // stand-in trees of their own, one installed and one not, never this one: the
  // expectation was once read from this tree's ux/node_modules when the run began
  // and the guard read it again when its case ran, so an install under way in
  // between (npm empties the folder first) failed both refusals (2026-10-30), and
  // in the gate's snapshot, which has none, the refusal was never tried at all.
  'session/guard-npm-ci.mjs': (() => {
    const installed = join(turns, 'npm-ci-installed');
    const bare = join(turns, 'npm-ci-bare');
    mkdirSync(join(installed, 'ux', 'node_modules'), { recursive: true });
    mkdirSync(join(bare, 'ux'), { recursive: true });
    const at = (root) => ({ CLAUDE_PROJECT_DIR: root });
    return [
      ['the incident: refuses npm --prefix ux ci from the root (2026-10-10)', { cwd: installed, tool_input: { command: 'npm --prefix ux ci --no-audit --no-fund' } }, 'deny', at(installed)],
      ['refuses cd ux and npm ci', { cwd: installed, tool_input: { command: 'cd ux && npm ci' } }, 'deny', at(installed)],
      ["passes a checkout's own install", { cwd: installed, tool_input: { command: 'npm --prefix temp/hb-run/ux ci --no-audit' } }, 'pass', at(installed)],
      ['passes npm install, which repairs in place', { cwd: join(installed, 'ux'), tool_input: { command: 'npm install --no-audit' } }, 'pass', at(installed)],
      ['passes npm ci in a tree with nothing installed', { cwd: bare, tool_input: { command: 'npm --prefix ux ci' } }, 'pass', at(bare)],
    ];
  })(),
  // A merge settled by keeping one side of every clash (2026-10-29).
  'session/guard-one-sided-merge.mjs': [
    ['the incident: refuses merge -X ours of a session branch (2026-10-29)', { tool_name: 'Bash', tool_input: { command: 'cd /tmp/w && git merge -X ours -m "merge: a session branch into main" origin/claude/x' } }, 'deny'],
    ['refuses pull with --strategy-option=theirs', { tool_name: 'Bash', tool_input: { command: 'git pull --no-rebase --strategy-option=theirs origin main' } }, 'deny'],
    ['refuses -Xtheirs written together', { tool_name: 'Bash', tool_input: { command: 'git merge -Xtheirs main' } }, 'deny'],
    ['passes a plain merge', { tool_name: 'Bash', tool_input: { command: 'git merge --no-edit origin/main' } }, 'pass'],
    ['passes -s ours, which records a branch already in main', { tool_name: 'Bash', tool_input: { command: 'git merge -s ours -m "record merged" origin/claude/y' } }, 'pass'],
    ['passes checkout --theirs of one file after reading it', { tool_name: 'Bash', tool_input: { command: 'git checkout --theirs data-sample/x.md && git add data-sample/x.md' } }, 'pass'],
    ['passes a commit message that names the refused form (2026-11-03)', { tool_name: 'Bash', tool_input: { command: 'git commit -m "refuse git merge or pull with -X ours"' } }, 'pass'],
    ['still refuses the real merge after a quoted message', { tool_name: 'Bash', tool_input: { command: 'git merge -X ours -m "merge: x" main' } }, 'deny'],
  ],
  // SFG-006 design 5: a push or commit piped on hides its own failure.
  'session/guard-piped-push.mjs': [
    ['the incident: refuses a push piped to tail (chat of 2026-10-12 to 10-15)', { tool_name: 'Bash', tool_input: { command: 'for i in 1 2 3; do git push origin main 2>&1 | tail -1 && break; sleep 2; done' } }, 'deny'],
    ['refuses a commit piped to head', { tool_name: 'Bash', tool_input: { command: 'git -C /repo commit -q -m "save" 2>&1 | head -5' } }, 'deny'],
    ['passes the same push under pipefail', { tool_name: 'Bash', tool_input: { command: 'set -o pipefail; git push origin main 2>&1 | tail -1' } }, 'pass'],
    ['passes a push whose PIPESTATUS is read', { tool_name: 'Bash', tool_input: { command: 'git push origin main 2>&1 | tail -1; exit ${PIPESTATUS[0]}' } }, 'pass'],
    ['passes || and a | inside a commit message', { tool_name: 'Bash', tool_input: { command: 'git commit -m "a | b" || git push origin main' } }, 'pass'],
    ['passes another git command piped', { tool_name: 'Bash', tool_input: { command: 'git log --oneline | head -5' } }, 'pass'],
  ],
  // DEV-017 design 6: a subagent commits from its own worktree. A stand-in main checkout
  // (a .git folder), a stand-in worktree (a .git file), and a state folder of their own
  // holding another agent's stamp; lib/test-agent-own-copy.mjs covers the rest.
  'session/guard-agent-own-copy.mjs': (() => {
    const main = join(turns, 'own-copy-main');
    const wt = join(turns, 'own-copy-wt');
    const proj = join(turns, 'own-copy-proj');
    mkdirSync(join(main, '.git'), { recursive: true });
    mkdirSync(wt, { recursive: true });
    writeFileSync(join(wt, '.git'), 'gitdir: elsewhere\n');
    mkdirSync(join(proj, '.claude', 'hooks', 'state'), { recursive: true });
    writeFileSync(join(proj, '.claude', 'hooks', 'state', 'writer-selftest--agent-b.json'), JSON.stringify({ session: 'selftest', agent: 'agent-b', roots: { [main]: Date.now() } }));
    const at = { CLAUDE_PROJECT_DIR: proj };
    const commit = (cwd, agent, command = 'git commit -F msg -- dev/x.md') => ({ session_id: 'selftest', ...(agent && { agent_id: agent }), cwd, tool_name: 'Bash', tool_input: { command } });
    return [
      ['the incident: refuses a subagent commit in a checkout another agent is writing in (2026-11-03)', commit(main, 'agent-a'), 'deny', at],
      ["passes the main chat's own commit there", commit(main, null), 'pass', at],
      ["passes her record's save there", commit(main, 'agent-a', 'git commit -m "record: x" -- data/core/timeline.md'), 'pass', at],
      ['passes a subagent commit in its own worktree', commit(wt, 'agent-a'), 'pass', at],
    ];
  })(),
  'privacy/guard-harness-privacy.mjs': [
    ['allows an impersonal harness write', { tool_input: { file_path: 'ux/a.jsx', content: 'const a = 1;' } }, 'pass'],
    ['allows any write inside data/', { tool_input: { file_path: 'data/core/journal/x.md', content: 'anything at all' } }, 'pass'],
  ],
  'privacy/guard-outbound-privacy.mjs': [
    ['lets a general search through', { tool_name: 'WebSearch', tool_input: { query: 'evidence for sleep restriction therapy' } }, 'pass'],
    ['refuses a search carrying a name from the record', { tool_name: 'WebSearch', tool_input: { query: `what to say to ${RECORD_NAME} after a fight` } }, RECORD_NAME ? 'deny' : 'any'],
  ],
  'privacy/check-privacy-at-stop.mjs': [
    ['never loops on itself', { hook_event_name: 'Stop', stop_hook_active: true }, 'pass'],
    ['passes a clean tree', { hook_event_name: 'Stop' }, 'pass'],
  ],
  // The person's-copy cases run in record/test-harness-lock.mjs, which builds a copy without dev/.
  // A release's trial runs this self-test in a copy without dev/ (DEP-013), where
  // the same edit must be refused: the case is judged by whose copy it runs in.
  'record/guard-harness-lock.mjs': [
    existsSync(join(repoRoot, 'dev'))
      ? ["passes a harness edit in the developer's copy", { tool_name: 'Edit', tool_input: { file_path: 'CLAUDE.md' } }, 'pass']
      : ["refuses a harness edit in a person's copy", { tool_name: 'Edit', tool_input: { file_path: 'CLAUDE.md' } }, 'deny'],
    ["passes a shell write in the developer's copy", { tool_input: { command: 'echo x > temp/selftest.txt' } }, 'pass'],
  ],
  'record/guard-record-deletion.mjs': [
    ['refuses rm against the record', { tool_input: { command: 'rm -f data/core/timeline.md' } }, 'deny'],
    ['refuses rm of the whole record', { tool_input: { command: 'rm -rf data' } }, 'deny'],
    ['refuses a PowerShell delete', { tool_input: { command: 'Remove-Item -Recurse data\\people' } }, 'deny'],
    ['refuses git rm of a record file', { tool_input: { command: 'git rm data/core/people/x.md' } }, 'deny'],
    ['refuses a truncating redirect', { tool_input: { command: 'echo x > data/core/state/now.md' } }, 'deny'],
    ['refuses a move out of the record', { tool_input: { command: 'mv data/core/journal/x.md temp/' } }, 'deny'],
    ['refuses a quoted path', { tool_input: { command: 'rm "data/core/journal/x.md"' } }, 'deny'],
    ['refuses a delete run through a shell', { tool_input: { command: 'bash -c "rm data/core/journal/x.md"' } }, 'deny'],
    ['allows the words inside quoted prose', { tool_input: { command: 'printf "%s\\n" "after a plain mv into data/ it untracked" >> notes.md' } }, 'pass'],
    ['refuses a whole-file Write over a record file', { tool_name: 'Write', tool_input: { file_path: 'data/core/timeline.md', content: 'x' } }, 'deny'],
    ['allows a Write that creates a record file', { tool_name: 'Write', tool_input: { file_path: 'data/core/journal/selftest-new.md', content: 'x' } }, 'pass'],
    ['allows a move into the archive', { tool_input: { command: 'mv data/core/journal/x.md data/archive/x.md' } }, 'pass'],
    ['allows moving scratch into the archive', { tool_input: { command: 'mv temp/old data/archive/old' } }, 'pass'],
    ['allows an append', { tool_input: { command: 'echo x >> data/core/timeline.md' } }, 'pass'],
    ['allows deleting scratch', { tool_input: { command: 'rm temp/x.log' } }, 'pass'],
    ['allows deleting a path that only contains data/', { tool_input: { command: 'rm -rf temp/data/x' } }, 'pass'],
    ['allows a commit message that mentions rm', { tool_input: { command: 'git commit -m "chore: rm data/x was refused"' } }, 'pass'],
    ['allows ordinary commands', { tool_input: { command: 'git status --porcelain' } }, 'pass'],
    // Design audit, 2026-10-08: emptying or overwriting through the shell.
    ['refuses copying the null device over a record file', { tool_input: { command: 'cp /dev/null data/core/timeline.md' } }, 'deny'],
    ['refuses copying over a record file', { tool_input: { command: 'cp temp/x.md data/core/timeline.md' } }, 'deny'],
    ['refuses emptying a record file in PowerShell', { tool_input: { command: 'Clear-Content data/core/timeline.md' } }, 'deny'],
    ['refuses Set-Content over a record file', { tool_input: { command: 'Set-Content data/core/timeline.md "x"' } }, 'deny'],
    ['refuses a tee that overwrites a record file', { tool_input: { command: 'echo x | tee data/core/timeline.md' } }, 'deny'],
    ['allows a tee that appends', { tool_input: { command: 'echo x | tee -a data/core/timeline.md' } }, 'pass'],
    ['allows Add-Content style appends with -Append', { tool_input: { command: 'Out-File -Append data/core/timeline.md' } }, 'pass'],
    ['allows copying a new file into the record', { tool_input: { command: 'cp temp/new.md data/core/journal/selftest-new-copy.md' } }, 'pass'],
    ['allows copying a record file out', { tool_input: { command: 'cp data/core/timeline.md temp/timeline-copy.md' } }, 'pass'],
  ],
  'record/guard-record-history.mjs': [
    ['refuses reading an old profile', { tool_input: { command: 'git show e3540d3:data/PROFILE.yaml | head' } }, 'deny'],
    ['refuses a patch log of the record', { tool_input: { command: 'git log -p -- data/core/timeline.md' } }, 'deny'],
    ['refuses restoring the record', { tool_input: { command: 'git checkout e3540d3 -- data' } }, 'deny'],
    ['refuses a diff of the record', { tool_input: { command: 'cd x && git diff HEAD -- data' } }, 'deny'],
    ['allows a list of what changed', { tool_input: { command: 'git log --stat -3 -- data' } }, 'pass'],
    ['allows committing the record', { tool_input: { command: 'git add data/ && git commit -m "record: update timeline"' } }, 'pass'],
    ['allows reading another repository', { tool_input: { command: 'git -C ../old show HEAD:data/me.md' } }, 'pass'],
    ['allows history outside the record', { tool_input: { command: 'git show HEAD:ux/app.jsx' } }, 'pass'],
    // Design audit, 2026-10-08: git's global options before the subcommand.
    ['refuses a show behind --no-pager', { tool_input: { command: 'git --no-pager show HEAD:data/PROFILE.yaml' } }, 'deny'],
    ['refuses a show behind -C pointing here', { tool_input: { command: 'git -C . show HEAD:data/PROFILE.yaml' } }, 'deny'],
    ['refuses a show behind a config option', { tool_input: { command: 'git -c core.pager=cat show HEAD:data/PROFILE.yaml' } }, 'deny'],
    ['refuses a show behind --git-dir pointing here', { tool_input: { command: 'git --git-dir=.git show HEAD:data/PROFILE.yaml' } }, 'deny'],
    ['allows a list behind --no-pager', { tool_input: { command: 'git --no-pager log --stat -3 -- data' } }, 'pass'],
  ],
  'record/guard-protected-files.mjs': [
    ['refuses an edit to CLAUDE.md', { tool_input: { file_path: 'CLAUDE.md' } }, 'deny'],
    ['refuses an edit to a spec', { tool_input: { file_path: 'dev/specs/system/ARCHITECTURE.md' } }, 'deny'],
    ['refuses an edit to a nested spec', { tool_input: { file_path: 'dev/specs/ux/tabs/now.md' } }, 'deny'],
    ['refuses an edit to the archive', { tool_input: { file_path: 'data/archive/old.md' } }, 'deny'],
    ['allows an ordinary record write', { tool_input: { file_path: 'data/core/timeline.md' } }, 'pass'],
  ],
  'record/guard-git-history.mjs': [
    ['refuses a force push', { tool_input: { command: 'git push --force origin main' } }, 'deny'],
    ['refuses a force push flag later in a chain', { tool_input: { command: 'git add -A && git push origin main -f' } }, 'deny'],
    ['refuses a hard reset', { tool_input: { command: 'git reset --hard HEAD~1' } }, 'deny'],
    ['refuses an amend', { tool_input: { command: 'git commit --amend -m x' } }, 'deny'],
    ['refuses discarding unsaved work', { tool_input: { command: 'git restore ux/a.jsx' } }, 'deny'],
    ['refuses deleting .git', { tool_input: { command: 'rm -rf .git' } }, 'deny'],
    ['refuses deleting the GitHub repo', { tool_input: { command: 'gh repo delete owner/x --yes' } }, 'deny'],
    ['refuses a write inside .git/', { tool_input: { file_path: '.git/config' } }, 'deny'],
    ['allows commit and push', { tool_input: { command: 'git add -A && git commit -m "fix: x" && git push origin main' } }, 'pass'],
    ['allows a message that mentions a rebase', { tool_input: { command: 'git commit -m "docs: never rebase or force push"' } }, 'pass'],
    ['allows a heredoc message that mentions a rebase', { tool_input: { command: "git commit -F - <<'EOF'\nfix: x\n\nno git rebase, no git push --force\nEOF" } }, 'pass'],
    ['allows unstaging', { tool_input: { command: 'git restore --staged ux/a.jsx' } }, 'pass'],
    ['allows switching branch', { tool_input: { command: 'git switch -c feature' } }, 'pass'],
    ['allows deleting an ordinary file', { tool_input: { command: 'rm temp/x.log' } }, 'pass'],
    ['allows touching .github/ and .gitignore', { tool_input: { command: 'rm .github/old.yml .gitignore.bak' } }, 'pass'],
    ['allows editing CLAUDE.md', { tool_input: { file_path: 'CLAUDE.md' } }, 'pass'],
    // Design audit, 2026-10-08: git's global options before the subcommand.
    ['refuses a force push behind a config option', { tool_input: { command: 'git -c x=y push --force origin main' } }, 'deny'],
    ['refuses an amend behind -C', { tool_input: { command: 'git -C . commit --amend -m x' } }, 'deny'],
    ['refuses a hard reset behind --no-pager', { tool_input: { command: 'git --no-pager reset --hard HEAD~1' } }, 'deny'],
    ['refuses a rebase behind a quoted -C path', { tool_input: { command: 'git -C "../my repo" rebase main' } }, 'deny'],
    ['refuses a forced branch delete behind --git-dir', { tool_input: { command: 'git --git-dir=.git branch -D x' } }, 'deny'],
    ['allows a commit behind -C', { tool_input: { command: 'git -C ../other commit -m "fix: x"' } }, 'pass'],
    ['allows a push behind a config option', { tool_input: { command: 'git -c http.version=HTTP/1.1 push origin main' } }, 'pass'],
    // The gate's own way round (unlock, 2026-11-03): a commit the commit gate never sees.
    ['refuses git commit-tree, a commit the gate never sees', { tool_input: { command: 'git commit-tree HEAD^{tree} -p HEAD -m x' } }, 'deny'],
    ['refuses a commit with --no-verify', { tool_input: { command: 'git commit --no-verify -m "fix: x"' } }, 'deny'],
    ['refuses a commit with -n, the short --no-verify', { tool_input: { command: 'git add -A && git commit -n -m x' } }, 'deny'],
    ['refuses a merge or push with --no-verify', { tool_input: { command: 'git merge --no-verify main && git push --no-verify origin main' } }, 'deny'],
    ['refuses pointing git at other hooks for one command', { tool_input: { command: 'git -c core.hooksPath=/dev/null commit -m x' } }, 'deny'],
    ['refuses setting core.hooksPath', { tool_input: { command: 'git config core.hooksPath /tmp/none' } }, 'deny'],
    ['allows reading core.hooksPath', { tool_input: { command: 'git config --get core.hooksPath' } }, 'pass'],
    ['allows switching the gate back on (set-up repair)', { tool_input: { command: 'git config core.hooksPath .claude/hooks/git' } }, 'pass'],
    ['refuses a hooks folder named like the gate but elsewhere', { tool_input: { command: 'git config core.hooksPath .claude/hooks/git-off' } }, 'deny'],
    ['allows a message that mentions --no-verify', { tool_input: { command: 'git commit -m "docs: never --no-verify or commit-tree"' } }, 'pass'],
    ['allows push -n, a dry run', { tool_input: { command: 'git push -n origin main' } }, 'pass'],
  ],
  'record/timeline-before-close.mjs': [
    ['never loops on itself', { session_id: 'selftest', stop_hook_active: true }, 'pass'],
  ],
  'session/install-deps.mjs': [
    ['touches nothing under the selftest', {}, 'pass'],
  ],
  'session/heartbeats-at-start.mjs': [
    ['stays out of the selftest', {}, 'pass'],
  ],
  'session/selftest-at-start.mjs': [
    ['does not run itself under the selftest', {}, 'pass'],
  ],
  'session/everyday-shape-check.mjs': [
    ['never loops on itself', { stop_hook_active: true }, 'pass'],
    ['notes, never blocks, a reply with headings', { session_id: 'selftest-everyday', transcript_path: turn("## How you're feeling\nThat sounds hard.") }, 'pass'],
  ],
  'session/dev-mode-reset.mjs': [
    ['leaves a real chat alone under the selftest', { source: 'clear', session_id: 'selftest-reset' }, 'pass'],
  ],
  'session/sweep-temp.mjs': [
    ['sweeps quietly', {}, 'pass'],
  ],
  'record/save-notice.mjs': [
    ['never loops on itself', { stop_hook_active: true }, 'pass'],
    ['notes, never sends back, a record write the reply does not mention', { transcript_path: turn('') }, 'pass'],
    ['passes a record write the reply names', { transcript_path: turn('Glad you told me.\n\n---\n📝 I have kept the appointment, and how the evening went.') }, 'pass'],
    ['notes a 📝 line with no rule above it', { transcript_path: turn('Glad you told me.\n\n📝 I have kept the appointment, and how the evening went.') }, 'pass'],
    ['notes a stock 📝 line', { transcript_path: turn('Glad.\n\n---\n📝 I have noted that.') }, 'pass'],
    ['notes a 📝 line repeated word for word', { transcript_path: turn('Okay.\n\n---\n📝 Kept the appointment and the evening.', undefined, false, 'Sure.\n\n---\n📝 Kept the appointment and the evening.') }, 'pass'],
    ['passes when there is no transcript', {}, 'pass'],
    ['passes a scratch copy whose folder is called data/', { transcript_path: turn('', { name: 'Write', input: { file_path: join(tmpdir(), 'scratch', 'A', 'data', 'core', 'y.md') } }) }, 'pass'],
    ['passes a record write that was refused', { transcript_path: turn('', { name: 'Bash', input: { command: 'echo y >> data/core/y.md' } }, true) }, 'pass'],
  ],
  'record/record-gate.mjs': [
    ['runs the checks and decides', { session_id: 'selftest' }, 'any'],
  ],
  'record/save-record.mjs': [
    // Read-only here: with nothing staged in data/ it must reach the end and
    // touch nothing. The commit and push paths are exercised against a throwaway
    // repository, not this one.
    ['no-ops when the record has not moved', {}, 'any'],
  ],
  'record/check-profile.mjs': [
    ['never loops on itself', { hook_event_name: 'Stop', stop_hook_active: true }, 'pass'],
    ['passes a valid profile after an edit', { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'data/PROFILE.yaml' } }, 'pass'],
  ],
  'session/session-brief.mjs': [['reports the state of the save', {}, 'any']],
  'session/session-context.mjs': [
    ['briefs a new session', { hook_event_name: 'SessionStart' }, 'any'],
    ['briefs again after a compaction', { hook_event_name: 'SessionStart', source: 'compact' }, 'any'],
    ['stays silent before a compaction, which takes no context', { hook_event_name: 'PreCompact' }, 'pass'],
  ],
  // An ordinary message only: a /dev-mode case would write the marker for the session running this.
  'session/new-chat-tip.mjs': [['runs on an ordinary message and never refuses', { session_id: 'selftest', prompt: 'hi', transcript_path: '/nonexistent' }, 'any']],
  'record/new-chat-tip-shown.mjs': [['runs at a turn end and never refuses', { session_id: 'selftest', transcript_path: '/nonexistent' }, 'any']],
  'session/dev-done-notify.mjs': [
    ['runs at a turn end, sends nothing outside a development chat, and never refuses', { session_id: 'selftest', transcript_path: '/nonexistent' }, 'any'],
    ['is silent on a permission prompt outside a development chat (T-813)', { session_id: 'selftest', hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash', transcript_path: '/nonexistent' }, 'pass'],
  ],
  'session/everyday-voice.mjs': [['runs on an ordinary message and never refuses', { session_id: 'selftest', prompt: 'can you save that' }, 'any']],
  // The dev-mode marker follows the session running this, so these cases hold either way.
  'session/dev-reply-shape.mjs': [
    ['runs on an ordinary message and never refuses', { session_id: 'selftest', prompt: 'can you save that' }, 'any'],
    ['resets quietly before a compaction', { session_id: 'selftest', hook_event_name: 'PreCompact' }, 'pass'],
  ],
  // Recording itself is proven in session/test-dialogue-record.mjs, on a throwaway
  // folder: a case here that recorded would write into the real Transcript.
  'session/dialogue-record.mjs': [
    ['records nothing outside development mode', { session_id: 'selftest-dialogue-record', prompt: 'make the export faster' }, 'pass'],
    ['records no relayed frame', { session_id: 'selftest-dialogue-record', prompt: '[Subagent hand-back] all done' }, 'pass'],
  ],
  'session/dev-reply-check.mjs': [
    ['never loops on itself', { stop_hook_active: true }, 'pass'],
    ['never sends a reply back, only notes it', { session_id: 'selftest', transcript_path: turn('Sure, done.', { name: 'Read', input: { file_path: 'README.md' } }) }, 'pass'],
  ],
  'session/sandbox-reminder.mjs': [['is silent outside the sandbox', { session_id: 'selftest' }, 'any']],
  'session/policy-review-due.mjs': [
    ['is silent on an ordinary message', { prompt: 'work was busy but fine' }, 'pass'],
    ['reads the tracker on /dev-mode', { prompt: '/dev-mode' }, 'any'],
  ],
  'session/skill-precursor.mjs': [
    ['is silent in her chat', { session_id: 'selftest', tool_name: 'Skill', tool_input: { skill: 'set-up' } }, 'pass'],
    ['is silent on another tool', { session_id: 'selftest', tool_name: 'Bash', tool_input: { command: 'ls' } }, 'pass'],
  ],
  'session/guard-chat-emoji.mjs': [
    ['lets a chat named with an emoji start', { tool_name: 'mcp__claude-code-remote__create_session', tool_input: { title: '🔎 Check' } }, 'pass'],
    ['refuses a chat named without one', { tool_name: 'mcp__claude-code-remote__create_session', tool_input: { title: 'Check' } }, 'deny'],
  ],
  'record/guard-calendar-writes.mjs': [
    ['lets a plain event through', { tool_name: 'mcp__Google_Calendar__create_event', tool_input: { summary: 'x', startTime: '2026-01-01T10:00:00', endTime: '2026-01-01T11:00:00' } }, 'pass'],
    ['refuses an event with a guest', { tool_name: 'mcp__Google_Calendar__create_event', tool_input: { summary: 'x', startTime: '2026-01-01T10:00:00', endTime: '2026-01-01T11:00:00', attendees: [{ email: 'a@example.com' }] } }, 'deny'],
    ['refuses a cancellation that would email guests', { tool_name: 'mcp__Google_Calendar__delete_event', tool_input: { eventId: 'x' } }, 'deny'],
    ['lets a silent cancellation through', { tool_name: 'mcp__Google_Calendar__delete_event', tool_input: { eventId: 'x', notificationLevel: 'NONE' } }, 'pass'],
  ],
  'session/session-log.mjs': [['does not log a cleared context', { reason: 'clear' }, 'pass']],
  // Safe on the live repository: it only ever deletes with -d and removes a
  // worktree without --force, both of which refuse unmerged or unsaved work.
  'session/prune-branches.mjs': [['clears only merged branches, silently', { hook_event_name: 'SessionStart' }, 'pass']],
  'session/track-touched.mjs': [
    ['records an edit and never refuses', { session_id: 'selftest', tool_name: 'Edit', tool_input: { file_path: 'README.md' } }, 'pass'],
    ['records nothing for a read-only command', { session_id: 'selftest', tool_name: 'Bash', tool_input: { command: 'grep -rn x specs' } }, 'pass'],
  ],
  'session/spec-context.mjs': [
    // A fresh session id each run: the hook names a spec once per session. A
    // copy without the design has none to name, and stays silent (ARC-008).
    ['names the specs governing a harness file', { session_id: `selftest-${Date.now()}`, tool_name: 'Edit', tool_input: { file_path: 'dev/ui/lib/git.js' } }, existsSync(join(repoRoot, SPECS_DIR)) ? 'context' : 'pass'],
    ['says nothing about a record file', { session_id: `selftest-${Date.now()}`, tool_name: 'Edit', tool_input: { file_path: 'data/core/state/now.md' } }, 'pass'],
  ],
};

function classify(stdout, payload = {}) {
  if (!stdout.trim()) return 'pass';
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return 'unparseable';
  }
  if (parsed.decision === 'block') return 'block';
  const out = parsed.hookSpecificOutput ?? {};
  // Claude Code rejects output named for an event that takes none, or for an
  // event other than the one that ran: the developer sees a schema error and the
  // model sees nothing (PreCompact, 2026-10-01). 'any' used to pass it.
  const ran = payload.hook_event_name;
  if (out.hookEventName && (!CONTEXT_EVENTS.includes(out.hookEventName) || (ran && out.hookEventName !== ran))) return 'wrong event';
  if (out.permissionDecision === 'deny') return 'deny';
  if (out.additionalContext) return 'context';
  return 'unrecognised';
}

/** Every hook on disk, so a new one cannot be added without a case for it. */
function everyHook() {
  const found = [];
  for (const folder of readdirSync(hooksDir, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name === 'lib') continue;
    for (const file of readdirSync(join(hooksDir, folder.name))) {
      // test-*.mjs are rule tests, not hooks: run once below, never with a payload.
      if (file.endsWith('.mjs') && !file.startsWith('test-')) found.push(`${folder.name}/${file}`);
    }
  }
  return found.sort();
}

// DEAR_RECORD_READONLY: a case that fires the crisis list must not write its
// marker into her real log (safety/crisis-floor.mjs).
// Without the chat's own session id, so each case's payload decides (see below).
const { CLAUDE_CODE_SESSION_ID: _chat, CLAUDE_CODE_REMOTE_SESSION_ID: _remote, ...outer } = process.env;
// Unsigned: a test's throwaway commits never go through the machine's signer (lib/unsigned-git.mjs).
const env = unsignedEnv({ ...outer, CLAUDE_PROJECT_DIR: repoRoot, DEAR_HOOK_STRICT: '1', DEAR_RECORD_READONLY: '1' });

/**
 * Run one hook exactly as Claude Code does: a payload on stdin, and stdin then
 * closed. Closing it is the whole point — a hook awaiting a stream nobody ends
 * hangs until its timeout, which is how this runner's first version reported
 * every hook as crashing.
 */
function runHook(file, payload, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { cwd: repoRoot, env: { ...env, ...extraEnv }, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, hung: true });
    }, 180000); // a hook test, not a hook: 60 s timed out heavy tests on a loaded machine (2026-10-30); 120 s timed out record/test-save-to-main.mjs, 109 s alone, whenever other chats ran (2026-11-02, T-624)
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

let failed = 0;

console.log(`\n  hooks selftest — ${relative(process.cwd(), hooksDir) || hooksDir}\n`);

async function runCases(hook) {
  const cases = CASES[hook];
  if (!cases) {
    console.log(`  MISSING CASE  ${hook} — every hook needs one, or it can die unnoticed`);
    failed += 1;
    return;
  }
  // A case may carry a fourth part: variables of its own, such as a stand-in tree.
  for (const [what, payload, expected, extraEnv] of cases) {
    const started = Date.now();
    const { stdout, stderr, code, hung } = await runHook(join(hooksDir, hook), payload, extraEnv);
    const ms = Date.now() - started;

    // A hook may only ever exit 0: any other code is Claude Code's signal to
    // block the call, and none of these means to block by dying.
    const crash = hung
      ? 'hung on stdin or a child process'
      : code !== 0
        ? `exit ${code} — ${stderr.split('\n').filter(Boolean).slice(0, 2).join(' ')}`
        : stderr.trim()
          ? `wrote to stderr — ${stderr.split('\n')[0]}`
          : '';
    const got = crash ? 'CRASH' : classify(stdout, payload);
    const ok = !crash && (expected === 'any' ? !['unparseable', 'unrecognised', 'wrong event'].includes(got) : got === expected);
    if (!ok) failed += 1;
    // An 'any' case still prints what it got: a hook that blocks every turn is
    // passing this test and failing her, and that has to be visible here.
    const note = ok && expected === 'any' ? ` → ${got}` : '';
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${String(ms).padStart(4)}ms  ${hook.padEnd(38)} ${what}${note}` +
        (ok ? '' : `\n           expected ${expected}, got ${got}${crash ? ` — ${crash}` : ''}`),
    );
  }
}

// The privacy stop hook scans the whole tree, and a busy machine once took that
// scan past this runner's 30s (2026-10-03): it runs first and alone, before the
// rule tests below start, so nothing here slows it.
const hooks = everyHook();
// A-164: a commit of only code outside the safety and privacy surfaces runs the
// hook cases and rule tests that reach a changed file (lib/affected.mjs); the
// gate names the commit's files in DEAR_SELFTEST_STAGED. Every hook still needs
// its case. Unset, as on the daily safeguard check and a release: everything.
const narrowTo = (process.env.DEAR_SELFTEST_STAGED ?? '').split('\n').filter(Boolean);
const narrow = narrowable(narrowTo);
const reach = narrow ? reacher(repoRoot) : null;
const keep = (files) => (narrow ? new Set(affected(repoRoot, files, narrowTo, reach)) : new Set(files));
const runHooks = keep(hooks.map((h) => `.claude/hooks/${h}`));
for (const hook of hooks) if (!runHooks.has(`.claude/hooks/${hook}`) && !CASES[hook]) {
  console.log(`  MISSING CASE  ${hook} — every hook needs one, or it can die unnoticed`);
  failed += 1;
}
const ALONE = ['privacy/check-privacy-at-stop.mjs'].filter((h) => hooks.includes(h) && runHooks.has(`.claude/hooks/${h}`));
for (const hook of ALONE) await runCases(hook);

// The rule tests a hook depends on: a hook can be alive and deciding on rules
// that have quietly stopped firing, and this is where that shows.
// Each works in its own throwaway folder, so they run side by side, and beside
// the hook cases below, and report once those are done: one after another, they
// alone took the whole run past the commit gate's minute (2026-10-04), and
// waiting for the hook cases before starting added their slowest to the run.
const ruleTests = readdirSync(hooksDir, { withFileTypes: true })
  .filter((folder) => folder.isDirectory())
  .flatMap((folder) => readdirSync(join(hooksDir, folder.name)).filter((f) => /^test-.*\.mjs$/.test(f)).map((file) => ({ folder, file })))
  .filter(({ folder, file }, _, all) => keep(all.map((t) => `.claude/hooks/${t.folder.name}/${t.file}`)).has(`.claude/hooks/${folder.name}/${file}`));
if (narrow) console.log(`  narrowed to the change (A-164): ${runHooks.size} of ${hooks.length} hooks, ${ruleTests.length} rule tests reach ${narrowTo.length} changed file(s)\n`);
// At most a few per core at once (2026-11-05): all of them started together, and with two or three
// selftests on one machine (a heartbeat's jobs committing side by side) the heavy ones ran out of
// their 180 s and a copy met a file another test was writing. Each test's clock starts when it
// does, so a queued test loses no time; the tests and their limits are the same.
const RULE_SLOTS = Math.max(4, availableParallelism() * 2);
const ruleRunning = (async () => {
  const out = new Array(ruleTests.length);
  let next = 0;
  const worker = async () => {
    while (next < ruleTests.length) {
      const i = next++;
      const { folder, file } = ruleTests[i];
      const started = Date.now();
      out[i] = { folder, file, started, ...(await runHook(join(hooksDir, folder.name, file), {})), ended: Date.now() };
    }
  };
  await Promise.all(Array.from({ length: Math.min(RULE_SLOTS, ruleTests.length) }, worker));
  return out;
})();

for (const hook of hooks.filter((h) => !ALONE.includes(h) && runHooks.has(`.claude/hooks/${h}`))) await runCases(hook);

// A hook wired to an event that takes no context (PreCompact, SessionEnd, …)
// must be proven silent there: its case above, run under that event's name, is
// the only place a schema error shows before the developer meets it
// (session-context.mjs under PreCompact, 2026-10-01).
{
  const settings = JSON.parse(readFileSync(join(hooksDir, '..', 'settings.json'), 'utf8'));
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    if (CONTEXT_EVENTS.includes(event) || event === 'PermissionRequest') continue;
    for (const group of groups) {
      for (const { command } of group.hooks ?? []) {
        const hook = (String(command).match(/hooks\/([\w-]+\/[\w.-]+\.mjs)/) ?? [])[1];
        if (!hook) continue;
        const proven = (CASES[hook] ?? []).some(([, payload, expected]) => payload?.hook_event_name === event && expected === 'pass');
        console.log(`  ${proven ? 'ok  ' : 'FAIL'}        ${hook.padEnd(38)} is silent under ${event}, which takes no context`);
        if (!proven) failed += 1;
      }
    }
  }
}

const ruleRuns = await ruleRunning;
{
  for (const { folder, file, started, ended, stdout, stderr, code } of ruleRuns) {
    const ok = code === 0;
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${String(ended - started).padStart(4)}ms  ${`${folder.name}/${file}`.padEnd(38)} ${(ok ? stdout : failureDetail(stdout, stderr)).trim().split('\n').slice(0, 6).join('\n           ')}`,
    );
  }
}

// The git hooks run only if git can execute them, and git says nothing when it
// cannot: commit-msg sat at mode 644 and looked in a people/ folder that had
// moved, so names reached history unrefused (2026-09-27 to 2026-09-29). Each
// must be executable as committed, and commit-msg must still refuse a name.
{
  const gitDir = join(hooksDir, 'git');
  // The commit gate runs this in a copy of the staged tree, which has no .git:
  // it names the real repository, whose index is what the commit carries.
  const gitRoot = process.env.DEAR_GIT_ROOT || repoRoot;
  const gitEnv = process.env.DEAR_GIT_INDEX ? { ...process.env, GIT_INDEX_FILE: process.env.DEAR_GIT_INDEX } : process.env;
  const modes = execFileSync('git', ['ls-files', '-s', '.claude/hooks/git'], { cwd: gitRoot, encoding: 'utf8', env: gitEnv });
  for (const file of readdirSync(gitDir).filter((f) => !f.includes('.'))) {
    const ok = modes.split('\n').some((l) => l.startsWith('100755') && l.endsWith(`/git/${file}`));
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}        git/${file.padEnd(34)} executable as committed`);
  }
  const msg = (text) => {
    const file = join(turns, `msg-${(turnCount += 1)}`);
    writeFileSync(file, text);
    try {
      // Without GIT_INDEX_FILE: these cases are about the message alone, never
      // what is staged in the tree they run in (the spec-row rule, test-refused-staged.mjs).
      const { GIT_INDEX_FILE: _index, ...msgEnv } = process.env;
      execFileSync(process.execPath, [join(gitDir, 'commit-msg'), file], { cwd: repoRoot, stdio: 'ignore', env: msgEnv });
      return 'pass';
    } catch {
      return 'refuse';
    }
  };
  const msgCases = [
    ['passes a message naming a folder', 'record: update people/', 'pass'],
    ['refuses a feat commit citing no spec row (WKB-007)', 'feat(hooks): something new\n\nNo row.', 'refuse'],
    ['passes a feat commit citing its spec row', 'feat(hooks): something new\n\nBuilt from WKB-007.', 'pass'],
    ['passes a fix commit with no row', 'fix(ux): a broken link', 'pass'],
  ];
  if (RECORD_NAME) msgCases.push(['refuses a message with a name on file', `record: update ${RECORD_NAME.toLowerCase()}`, 'refuse']);
  // A-155: a line of the record pasted into a body, as a quote, is refused like a name.
  // Taken from the record at run time and never printed; a copy with no long line has no case.
  {
    const { recordLines, templateLines } = await import('../../ux/scripts/check-privacy.mjs');
    const blank = templateLines(repoRoot);
    const RECORD_LINE = [...recordLines(join(repoRoot, 'data')).lines].find((l) => !blank.has(l));
    if (RECORD_LINE) msgCases.push(['refuses a message quoting a line of the record (A-155)', `fix(ux): a note\n\n> ${RECORD_LINE}`, 'refuse']);
    msgCases.push(['passes a long line of its own', 'fix(ux): a note\n\nA long line of the developer\'s own, about the gate and nothing of hers at all.', 'pass']);
  }
  for (const [what, text, expected] of msgCases) {
    const ok = msg(text) === expected;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}        ${'git/commit-msg'.padEnd(38)} ${what}`);
  }
}

// MEM-015: a missed 📝 line is noted for the next reply, never sent back.
{
  const id = 'selftest-save';
  const note = join(repoRoot, '.claude', 'hooks', 'state', `save-note-${id}`);
  await runHook(join(hooksDir, 'record', 'save-notice.mjs'), { session_id: id, transcript_path: turn('') });
  let noted = '';
  try {
    noted = readFileSync(note, 'utf8');
    rmSync(note, { force: true });
  } catch {
    /* no note written */
  }
  const ok = noted.includes('MEM-015');
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}        ${'record/save-notice.mjs'.padEnd(38)} notes a missed 📝 line for the next reply`);
}

// CON-017: a lesson written to FEEDBACK.md without the 🔧 line is noted for the next reply, never sent back.
{
  const id = 'selftest-lesson';
  const note = join(repoRoot, '.claude', 'hooks', 'state', `save-note-${id}`);
  const lesson = { name: 'Edit', input: { file_path: join(repoRoot, 'FEEDBACK.md') } };
  const run = async (reply) => {
    await runHook(join(hooksDir, 'record', 'save-notice.mjs'), { session_id: id, transcript_path: turn(reply, lesson) });
    let noted = '';
    try {
      noted = readFileSync(note, 'utf8');
      rmSync(note, { force: true });
    } catch {
      /* no note written */
    }
    return noted;
  };
  for (const [what, reply, expect] of [
    ['notes a lesson passed on without the 🔧 line', 'Thanks for telling me.', true],
    ['passes a lesson passed on with the 🔧 line', 'Thanks.\n\n---\n🔧 I have also passed a note to the developer, so I check your record first.', false],
  ]) {
    const ok = (await run(reply)).includes('CON-017') === expect;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}        ${'record/save-notice.mjs'.padEnd(38)} ${what}`);
  }
}

// A hook reads the session id from the environment before the payload
// (lib/sandbox.mjs), so a test run inside a development-mode chat hands every
// hook that chat's id, and a hook that stands aside in development mode passes
// its case without deciding anything (found 2026-09-30). The runs above strip
// it; this proves a mode-dependent hook really decides under the selftest.
{
  const id = 'selftest-everyday';
  const note = join(repoRoot, '.claude', 'hooks', 'state', `everyday-reply-note-${id}`);
  await runHook(join(hooksDir, 'session', 'everyday-shape-check.mjs'), { session_id: id, transcript_path: turn('## A heading\nThat sounds hard.') });
  let noted = '';
  try {
    noted = readFileSync(note, 'utf8');
    rmSync(note, { force: true });
  } catch {
    /* no note written: the hook never decided */
  }
  const ok = noted.includes('CON-014');
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}        ${'session/everyday-shape-check.mjs'.padEnd(38)} decides under the selftest, whatever chat runs it`);
}

// MEM-001 design 1: one reader lists every person once, by page or by folder,
// and reports a person held both ways.
{
  const { readPeople } = await import('./lib/people.mjs');
  const dir = makeTemp('dear-people-');
  mkdirSync(join(dir, 'person-a'));
  writeFileSync(join(dir, 'person-a', 'README.md'), 'x');
  writeFileSync(join(dir, 'person-b.md'), 'x');
  mkdirSync(join(dir, 'person-c'));
  writeFileSync(join(dir, 'person-c', 'README.md'), 'x');
  writeFileSync(join(dir, 'person-c.md'), 'x');
  const r = readPeople(dir);
  rmSync(dir, { recursive: true, force: true });
  const files = r.people.map((p) => p.file).join(',');
  const ok = files === 'person-a/README.md,person-b.md,person-c.md' && r.both.join(',') === 'person-c';
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}        ${'lib/people.mjs'.padEnd(38)} lists a person once, by page or folder, and reports both (MEM-001)`);
}

// The markers this run's own sessions left in the live state folder (every
// selftest session id starts `selftest`), removed so they do not pile up: on
// 2026-10-09 118 of its 346 files were spec-context markers from past runs.
// Safe under ARC-014 design 3, since a missing marker means recompute. The
// run's own report, selftest-last.json, is not a session marker and stays.
{
  const stateDir = join(repoRoot, '.claude', 'hooks', 'state');
  const ours = (name) => /-selftest(?:[-.]|$)/.test(name);
  const list = () => (existsSync(stateDir) ? readdirSync(stateDir).filter(ours) : []);
  for (const name of list()) rmSync(join(stateDir, name), { force: true });
  const left = list();
  const ok = left.length === 0 && ours('specs-named-selftest-1.json') && !ours('selftest-last.json') && !ours('specs-named-abc.json');
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}        ${'selftest.mjs'.padEnd(38)} leaves no session marker of its own in the state folder`);
}

// A-147: the tests above make most of the system temp folder's litter; clear what is a day old.
sweepLitter();
console.log(failed ? `\n  ${failed} failing\n` : '\n  all hooks alive and deciding\n');
process.exit(failed ? 1 : 0);
