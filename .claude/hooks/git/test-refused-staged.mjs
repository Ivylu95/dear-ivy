// Rule test for lib/refused-staged.mjs and its use in git/commit-msg: a refused
// commit's staged files are remembered, and the next commit that would carry
// them is told once (2026-09-30, 2026-10-03: they rode in under the wrong
// message). Then commit-msg's spec-row rule: a commit changing a register row
// names it and quotes its approval, merges aside (9755c5d over e3787b0;
// MNT-008); and its case-count rule: a
// check's cases never drop without a matching new one (SFG-014). Replayed in a throwaway
// repository. Run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIALOGUE_CHECKS, carriedFromRefused, dialogueOnly, forgetRefused, rememberRefused } from '../lib/refused-staged.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = makeTemp('dear-refused-');
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  // The real commit-msg hook, and the libraries it imports, in a bare repository.
  mkdirSync(join(dir, 'hooks'));
  cpSync(join(here, 'commit-msg'), join(dir, 'hooks', 'commit-msg'));
  cpSync(join(here, 'package.json'), join(dir, 'hooks', 'package.json'));
  mkdirSync(join(dir, '.claude', 'hooks'), { recursive: true });
  cpSync(join(here, '..', 'lib'), join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
  git('init', '-q');
  git('config', 'core.hooksPath', 'hooks');
  writeFileSync(join(dir, 'base.txt'), 'x');
  git('add', 'base.txt');
  git('commit', '-q', '--no-verify', '-m', 'base');

  // The incident: a feat commit with no row ID is refused, its file stays staged.
  writeFileSync(join(dir, 'stress.mjs'), 'a');
  git('add', 'stress.mjs');
  const refused = spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', 'commit', '-q', '-m', 'feat: no row cited'], { cwd: dir, encoding: 'utf8' });
  check('the commit-msg gate refuses a feat commit with no row', refused.status !== 0);
  check('the refusal remembers what it left staged', existsSync(join(dir, '.git', 'dear-refused-staged')));

  // The next commit stages another file on top: the leftover is named, once.
  writeFileSync(join(dir, 'reply.mjs'), 'b');
  git('add', 'reply.mjs');
  const staged = git('diff', '--cached', '--name-only').trim().split('\n');
  check('the next commit carrying it is told which file', JSON.stringify(carriedFromRefused(staged, dir)) === JSON.stringify(['stress.mjs']));
  check('it is told once: running again carries it on purpose', carriedFromRefused(staged, dir).length === 0);

  // The owner's yes, T-558 (E-058): the same commit run again, exactly the files the
  // refusal left, passes at once; refused, it re-armed with every slow check run.
  rememberRefused(dir);
  check('the same commit run again, same files, passes', carriedFromRefused([...staged], dir).length === 0);
  rememberRefused(dir);
  check('the same files in another order pass too', carriedFromRefused([...staged].reverse(), dir).length === 0);
  rememberRefused(dir);
  check('a retry staging one file more is still refused, naming the leftovers', JSON.stringify(carriedFromRefused([...staged, 'extra.mjs'], dir).sort()) === JSON.stringify([...staged].sort()));
  rememberRefused(dir);
  check('a commit carrying only some of the leftovers is still refused', carriedFromRefused([staged[0]], dir).length === 1);

  // A refusal with nothing of it carried forward stays quiet.
  rememberRefused(dir);
  git('restore', '--staged', '--', 'stress.mjs', 'reply.mjs');
  writeFileSync(join(dir, 'other.mjs'), 'c');
  git('add', 'other.mjs');
  check('a commit carrying none of the leftovers passes', carriedFromRefused(['other.mjs'], dir).length === 0);
  git('restore', '--staged', '--', 'other.mjs');

  // A caller that unstaged its own file after a refusal (heartbeats.mjs) takes
  // it off the note; anything else left staged is still named (a heartbeat finish,
  // 2026-10-10: its finish was refused for carrying a record no longer staged).
  writeFileSync(join(dir, 'record.md'), 'r');
  writeFileSync(join(dir, 'left.mjs'), 'l');
  git('add', 'record.md', 'left.mjs');
  rememberRefused(dir);
  git('restore', '--staged', '--', 'record.md');
  forgetRefused(['record.md'], dir);
  check('a file its caller unstaged is forgotten, the rest still named', JSON.stringify(carriedFromRefused(['record.md', 'left.mjs'], dir)) === JSON.stringify(['left.mjs']));
  git('restore', '--staged', '--', 'left.mjs');
  git('add', 'record.md');
  rememberRefused(dir);
  git('restore', '--staged', '--', 'record.md');
  forgetRefused(['record.md'], dir);
  check('with nothing left, the note is gone', !existsSync(join(dir, '.git', 'dear-refused-staged')));

  // The typed record is staged by its hook at every message, by design, so a
  // refusal finding it staged did not leave it there: it is never a leftover
  // (2026-10-27, about eight commits refused naming only it). A real leftover
  // beside it is still named.
  const typed = ['dev', 'dialogue', 'typed.jsonl'].join('/');
  mkdirSync(join(dir, 'dev', 'dialogue'), { recursive: true });
  writeFileSync(join(dir, typed), '{}\n');
  git('add', typed);
  rememberRefused(dir);
  check('the incident: the hook-staged typed record alone is not a leftover', carriedFromRefused([typed, 'next.mjs'], dir).length === 0);
  writeFileSync(join(dir, 'real.mjs'), 'r');
  git('add', 'real.mjs');
  rememberRefused(dir);
  check('a real leftover beside the typed record is still named, in a commit that adds its own file', JSON.stringify(carriedFromRefused([typed, 'real.mjs', 'own.mjs'], dir)) === JSON.stringify(['real.mjs']));
  git('restore', '--staged', '--', typed, 'real.mjs');

  // A new copy's first commit carries every file, and a refused one leaves them
  // all staged: its retry was refused naming all 649 (edge cases, 2026-10-29,
  // A11). With no HEAD yet, nothing rides in unseen, so nothing is named.
  {
    const fresh = makeTemp('dear-refused-unborn-');
    execFileSync('git', ['init', '-q'], { cwd: fresh });
    writeFileSync(join(fresh, 'a.md'), 'a');
    writeFileSync(join(fresh, 'b.md'), 'b');
    execFileSync('git', ['add', '-A'], { cwd: fresh });
    rememberRefused(fresh);
    check('the incident: a first commit\'s retry is not refused for carrying its own files', carriedFromRefused(['a.md', 'b.md'], fresh).length === 0);
    check('and the note is cleared', !existsSync(join(fresh, '.git', 'dear-refused-staged')));
    rmSync(fresh, { recursive: true, force: true });
  }

  // commit-msg: a commit that changes a spec row names it (9755c5d carried a
  // stale copy of ARC-005 under a message about FND-008, undoing e3787b0).
  const row = (id, words) => `---\n\n## **${id} • ✅**\n\n> ---\n>\n> ### **(§) SPEC STATEMENT —**\n>\n> ${words}\n>\n> ---\n`;
  const register = (one, two, between = '') => `# Test [TST]\n\n${row('TST-001', one)}${between}\n${row('TST-002', two)}`;
  const specFile = join(dir, 'dev', 'specs', 'system', 'test.md');
  mkdirSync(dirname(specFile), { recursive: true });
  writeFileSync(specFile, register('First row.', 'Second row.'));
  git('add', 'dev');
  git('commit', '-q', '--no-verify', '-m', 'the register');
  const commit = (msg) => spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', 'commit', '-q', '-m', msg], { cwd: dir, encoding: 'utf8' });
  const stage = (text) => {
    writeFileSync(specFile, text);
    git('add', 'dev');
  };

  stage(register('First row.', 'Second row, amended.'));
  const unnamed = commit('chore(skills): something else (TST-001)');
  check('a commit changing a row its message does not name is refused', unnamed.status !== 0 && /TST-002/.test(unnamed.stderr) && !/TST-001,/.test(unnamed.stderr));
  // MNT-008 design 2: a row changed carries the owner's approval, quoted.
  const unapproved = commit('fix(specs): TST-002 amended');
  check('a commit naming the row but quoting no approval is refused (MNT-008)', unapproved.status !== 0 && /no approval/.test(unapproved.stderr));
  check('an approval mid-line is not a line of its own, and is refused', commit('fix(specs): TST-002 amended, Approved: "yes"').status !== 0);
  check('a commit naming the row it changes, with its approval, passes', commit('fix(specs): TST-002 amended\n\nApproved: "yes, that wording"').status === 0);

  stage(register('First row.', 'Second row, amended.', '\n<!-- a note between rows -->\n'));
  check('a change between rows names no row and passes', commit('chore(specs): a note between rows').status === 0);

  stage(register('First row, reshaped.', 'Second row, reshaped.', '\n<!-- a note between rows -->\n'));
  check('a register reshaped as a whole passes when the message says so', commit('chore(specs): reshape\n\nRows: all in dev/specs/system/test.md\nApproved: "reshape it"').status === 0);

  // A merge carries rows already committed under their own messages.
  git('checkout', '-q', '-b', 'side');
  stage(register('First row, from a side branch.', 'Second row, reshaped.', '\n<!-- a note between rows -->\n'));
  git('commit', '-q', '-m', 'fix(specs): TST-001 on the side\n\nApproved: "yes"');
  git('checkout', '-q', '-');
  writeFileSync(join(dir, 'elsewhere.txt'), 'x');
  git('add', 'elsewhere.txt');
  git('commit', '-q', '-m', 'chore: elsewhere');
  const merged = spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', 'merge', '-q', '--no-ff', '-m', 'merge side', 'side'], { cwd: dir, encoding: 'utf8' });
  check('a merge bringing a row change in is let through', merged.status === 0);

  // MNT-008 design 5: a file a row's design names changes, and the row is
  // listed, never refused.
  mkdirSync(join(dir, 'ux', 'scripts'), { recursive: true });
  cpSync(join(here, '..', '..', '..', 'ux', 'scripts', 'design-paths.mjs'), join(dir, 'ux', 'scripts', 'design-paths.mjs'));
  mkdirSync(join(dir, 'ux', 'lib'), { recursive: true });
  cpSync(join(here, '..', '..', '..', 'ux', 'lib', 'walk-skip.mjs'), join(dir, 'ux', 'lib', 'walk-skip.mjs'));
  writeFileSync(join(dir, 'dev', 'specs', 'system', 'mech.md'), `# Mech [TST]\n\n${row('TST-009', 'A mechanism row.')}\n### **(#) DESIGN RECOMMENDATIONS —**\n\n1. **Do it** – For example, \`tool.mjs\`.\n`);
  writeFileSync(join(dir, 'tool.mjs'), 'one');
  git('add', '.');
  git('commit', '-q', '--no-verify', '-m', 'the mechanism');
  writeFileSync(join(dir, 'tool.mjs'), 'two');
  git('add', 'tool.mjs');
  const noted = commit('fix(tools): change the tool');
  check('a commit changing a file a design names passes (MNT-008)', noted.status === 0);
  check('and lists the row it does not name', /note \(MNT-008\).*TST-009/.test(noted.stderr));
  writeFileSync(join(dir, 'tool.mjs'), 'three');
  git('add', 'tool.mjs');
  check('a commit naming that row is not noted', !/MNT-008/.test(commit('fix(tools): the tool, TST-009 still holds').stderr));

  // commit-msg: a check's cases never drop without a matching new one (SFG-014).
  const selftest = join(dir, '.claude', 'hooks', 'selftest.mjs');
  const ruleTest = join(dir, '.claude', 'hooks', 'record', 'test-guard.mjs');
  const hookFile = join(dir, '.claude', 'hooks', 'record', 'guard.mjs');
  const table = (...cases) => `const CASES = {\n  'record/guard.mjs': [\n${cases.map((c) => `    ${c},`).join('\n')}\n  ],\n};\n`;
  const deny = (what) => `['${what}', { tool_input: { command: 'rm x' } }, 'deny']`;
  const allow = (what) => `['${what}', { tool_input: { command: 'ls' } }, 'pass']`;
  const tests = (...names) => names.map((n) => `check('${n}', true);`).join('\n');
  mkdirSync(dirname(hookFile), { recursive: true });
  writeFileSync(hookFile, '// a guard\n');
  writeFileSync(selftest, table(deny('refuses rm'), deny('refuses mv'), allow('allows ls')));
  writeFileSync(ruleTest, tests('one rule', 'another rule'));
  git('add', '.claude/hooks/selftest.mjs', '.claude/hooks/record');
  git('commit', '-q', '--no-verify', '-m', 'the checks');
  const stageCase = (file, text) => {
    writeFileSync(file, text);
    git('add', '.claude/hooks');
  };

  stageCase(selftest, table(deny('refuses rm'), allow('refuses mv'), allow('allows ls')));
  const weakened = commit('fix(hooks): tidy the guard');
  check('a refusal case turned to a pass is refused (SFG-014)', weakened.status !== 0 && /record\/guard\.mjs: 2 case\(s\) before, 1 now/.test(weakened.stderr));
  stageCase(selftest, table(deny('refuses rm'), allow('allows ls')));
  check('a refusal case removed is refused', commit('fix(hooks): tidy the guard').status !== 0);
  stageCase(selftest, table(deny('refuses rm'), deny('refuses a move'), allow('allows ls')));
  check('a refusal case reworded keeps its count and passes', commit('fix(hooks): reword a case').status === 0);
  stageCase(ruleTest, tests('one rule'));
  check('a rule test losing a case is refused', commit('fix(hooks): fewer rules').status !== 0);
  check('a case removed on purpose passes when the message says so', commit('fix(hooks): retire a rule\n\nCases-removed: .claude/hooks/record/test-guard.mjs — the rule it tested is gone').status === 0);
  git('rm', '-q', '.claude/hooks/record/guard.mjs');
  stageCase(selftest, 'const CASES = {};\n');
  check('a hook deleted takes its selftest cases with it', commit('fix(hooks): retire the guard').status === 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// The tracker end to end: a finish the gate refuses leaves the checkout clean
// and no note naming the record, so the next finish is judged on its own
// (a heartbeat finish, 2026-10-10: the second finish was refused for carrying the first's
// record, and the claim stayed running).
{
  const { update } = await import('../lib/heartbeats.mjs');
  const base = makeTemp('dear-hb-refused-');
  const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const origin = join(base, 'origin.git');
    const work = join(base, 'work');
    g(base, 'init', '-q', '--bare', '-b', 'main', origin);
    g(base, 'clone', '-q', origin, work);
    mkdirSync(join(work, '.claude', 'jobs'), { recursive: true });
    writeFileSync(join(work, '.claude', 'jobs', 'README.md'), '---\nstatus: ok\njobs: x\n---\n');
    writeFileSync(join(work, '.claude', 'jobs', 'x.md'), '---\nevery: 1 hour\nstatus: running\nfailures: 0\nlast_started: 2026-10-01T09:00:00.000Z\n---\n# x\n');
    g(work, 'add', '.');
    g(work, 'commit', '-q', '-m', 'base');
    g(work, 'push', '-q', 'origin', 'HEAD:main');
    // A gate that refuses while REFUSE is there, remembering what it left staged.
    const hooks = join(base, 'hooks');
    mkdirSync(hooks);
    const lib = join(here, '..', 'lib', 'refused-staged.mjs').replace(/\\/g, '/');
    writeFileSync(join(hooks, 'pre-commit'), `#!/usr/bin/env node\nimport { existsSync } from 'node:fs';\nimport { carriedFromRefused, rememberRefused } from ${JSON.stringify(`file://${lib.startsWith('/') ? '' : '/'}${lib}`)};\nimport { execFileSync } from 'node:child_process';\nconst staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).split('\\n').filter(Boolean);\nif (carriedFromRefused(staged).length) process.exit(1);\nif (existsSync(${JSON.stringify(join(base, 'REFUSE'))})) { rememberRefused(); process.exit(1); }\n`, { mode: 0o755 });
    g(work, 'config', 'core.hooksPath', hooks);
    g(work, 'config', 'user.email', 't@local');
    g(work, 'config', 'user.name', 't');
    const at = new Date('2026-10-01T10:00:00Z');
    writeFileSync(join(base, 'REFUSE'), '');
    const first = update(work, 'x', 'finish', 'ok', at);
    check('a finish the gate refuses is reported refused', first.result === 'refused');
    check('and leaves the checkout clean', g(work, 'status', '--porcelain').trim() === '');
    rmSync(join(base, 'REFUSE'));
    const second = update(work, 'x', 'finish', 'ok', at);
    check('the next finish is not refused for the record the first unstaged', second.result === 'pushed');
    // Since 2026-11-02 the record is in state.json, moved out of the job files by this finish (D1).
    check('and main records the job finished', JSON.parse(g(work, 'show', 'origin/main:.claude/jobs/state.json')).x?.status === 'ok' && !/status:/.test(g(work, 'show', 'origin/main:.claude/jobs/x.md')));
    // Once moved, a refused finish of the state file alone is unstaged and forgotten the same way.
    writeFileSync(join(base, 'REFUSE'), '');
    const third = update(work, 'x', 'finish', 'failed', at);
    check('a refused finish of the state file alone leaves the checkout clean', third.result === 'refused' && g(work, 'status', '--porcelain').trim() === '');
    rmSync(join(base, 'REFUSE'));
    check('and the next is not refused for it', update(work, 'x', 'finish', 'failed', at).result === 'pushed');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

// A-164: only a commit of the dialogue takes the fast path, and it still reads privacy and secrets.
const typedLog = ['dev', 'dialogue', ['typed', 'jsonl'].join('.')].join('/');
check('a Transcript save takes the fast path', dialogueOnly(['dev/dialogue/transcript/2026-11.md', 'dev/dialogue/agreements.md', 'dev/dialogue/index/README.md', typedLog]));
check('and so does one carrying the record with it', dialogueOnly(['dev/dialogue/transcript/2026-11.md', 'data/core/state/chats.json']));
check('a commit touching a hook does not', !dialogueOnly(['dev/dialogue/transcript/2026-11.md', '.claude/hooks/lib/hook.mjs']));
check('nor one touching a spec or a skill', !dialogueOnly(['dev/dialogue/agreements.md', 'dev/specs/system/dev.md']) && !dialogueOnly(['dev/dialogue/agreements.md', 'dev/skills/learning-chat/SKILL.md']));
check('a record-only commit is not this path (it passes at once)', !dialogueOnly(['data/core/timeline.md']));
check('the fast path still runs privacy, secrets and the dialogue check', ['privacy', 'secrets', 'dialogue'].every((c) => DIALOGUE_CHECKS.has(c)) && !DIALOGUE_CHECKS.has('hooks selftest'));

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
