// Rule test for git/commit-msg's approvals as typed (MNT-008, PMM-007): a
// commit changing a spec row, a skill's **Goal:** line, or set-up's Must hold
// block carries an `Approved: "…"` quote that is part of a message the
// developer typed, as lib/typed.mjs's record stands behind it. A quote never
// typed, or taken from an entry an agent wrote, is refused; his own words
// pass; a copy without the Transcript (ARC-008) asks no one. A skill added or
// removed whole asks the same yes; `--replay`, which CI runs on every push,
// finds a commit that went past the gate; an orphan branch is judged with its
// remote removed (t5, 2026-11-02). Replayed in a throwaway repository with the
// real hook. Run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPED_SINCE, recordTyped } from '../lib/typed.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = makeTemp('dear-approvals-');
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  mkdirSync(join(dir, 'hooks'));
  cpSync(join(here, 'commit-msg'), join(dir, 'hooks', 'commit-msg'));
  cpSync(join(here, 'package.json'), join(dir, 'hooks', 'package.json'));
  mkdirSync(join(dir, '.claude', 'hooks'), { recursive: true });
  cpSync(join(here, '..', 'lib'), join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
  git('init', '-q');
  git('config', 'core.hooksPath', 'hooks');

  // The Transcript as the recording hook leaves it, with its record; then one
  // entry an agent wrote itself, which the record does not stand behind.
  const transcript = join(dir, 'dev', 'dialogue', 'transcript');
  mkdirSync(transcript, { recursive: true });
  const said = (id, way, words) => `\n### ${id} · ${TYPED_SINCE} · ${way}\n> ${words}\n`;
  recordTyped('Okay, change that row the way you showed me', dir);
  recordTyped('Yes, reword the goal and the must hold block', dir);
  recordTyped('Yes, add that skill and retire the old one', dir);
  writeFileSync(
    join(transcript, `${TYPED_SINCE.slice(0, 7)}.md`),
    '# Transcript\n' +
      said('T-001', '🤝 agreement', 'Okay, change that row the way you showed me') +
      said('T-002', '🤝 agreement', 'Yes, reword the goal and the must hold block') +
      said('T-003', '🤝 agreement', 'yes, reword anything you like') +
      said('T-004', '🤝 agreement', 'Yes, add that skill and retire the old one'),
  );

  const row = (id, words) => `---\n\n## **${id} • ✅**\n\n> ---\n>\n> ### **(§) SPEC STATEMENT —**\n>\n> ${words}\n>\n> ---\n`;
  const specFile = join(dir, 'dev', 'specs', 'system', 'test.md');
  mkdirSync(dirname(specFile), { recursive: true });
  writeFileSync(specFile, `# Test [TST]\n\n${row('TST-001', 'First row.')}`);
  const setUp = join(dir, '.claude', 'skills', 'set-up', 'SKILL.md');
  const devSkill = join(dir, 'dev', 'skills', 'helper', 'SKILL.md');
  mkdirSync(dirname(setUp), { recursive: true });
  mkdirSync(dirname(devSkill), { recursive: true });
  const skill = (goal, hold = 'no secret printed.') => `---\nname: set-up\n---\n\n# Set up\n\n**Goal:** ${goal}\n\nSome words.\n\n**Must hold**, in every mode: ${hold}\nA second line of it.\n\n## 1. Steps\n\nMore.\n`;
  writeFileSync(setUp, skill('This copy works.'));
  writeFileSync(devSkill, '# Helper\n\n**Goal:** Help.\n\nBody.\n');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'base');

  const commit = (msg) => spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', 'commit', '-q', '-m', msg], { cwd: dir, encoding: 'utf8' });
  const stage = (file, text) => {
    writeFileSync(file, text);
    git('add', '-A');
  };
  const reset = () => git('reset', '-q', '--hard');

  // Spec rows (MNT-008).
  stage(specFile, `# Test [TST]\n\n${row('TST-001', 'First row, reworded.')}`);
  const forged = commit('fix(specs): TST-001 reworded\n\nApproved: "yes, that wording"');
  check('a spec row approved with words he never typed is refused', forged.status !== 0 && /as typed/.test(forged.stderr));
  check('a spec row approved with words from an entry an agent wrote is refused', commit('fix(specs): TST-001 reworded\n\nApproved: "yes, reword anything you like"').status !== 0);
  // 2026-11-04: `Approved: "Yes" (T-783)` was refused as "no approval", the line unnamed.
  const trailed = commit('fix(specs): TST-001 reworded\n\nApproved: "Okay, change that row" (T-001)');
  check('an Approved: line with words after its closing quote is refused, and named as misshapen', trailed.status !== 0 && /Not read as an approval: "Approved: \\"Okay, change that row\\" \(T-001\)"/.test(trailed.stderr) && /nothing after it/.test(trailed.stderr));
  const plain = commit('fix(specs): TST-001 reworded\n\nApproved: "yes, that wording"');
  check('a well-formed quote he never typed gets no shape hint', plain.status !== 0 && !/Not read as an approval/.test(plain.stderr));
  check('a spec row approved with his own words, as typed, passes', commit('fix(specs): TST-001 reworded\n\nApproved: "Okay, change that row"').status === 0);

  // A skill's Goal line, and set-up's Must hold block (PMM-007).
  stage(setUp, skill('This copy works, and reports itself.'));
  const bare = commit('fix(skills): set-up goal');
  check('a Goal line changed with no approval is refused', bare.status !== 0 && /Goal line/.test(bare.stderr));
  check('a Goal line changed with an approval he never typed is refused', commit('fix(skills): set-up goal\n\nApproved: "reword the goal freely"').status !== 0);
  check('a Goal line changed with his own words passes', commit('fix(skills): set-up goal\n\nApproved: "reword the goal"').status === 0);

  stage(setUp, skill('This copy works, and reports itself.', 'no secret printed, ever.'));
  const hold = commit('fix(skills): set-up must hold');
  check('the Must hold block changed with no approval is refused', hold.status !== 0 && /Must hold/.test(hold.stderr));
  check('the Must hold block changed with his own words passes', commit('fix(skills): set-up must hold\n\nApproved: "the must hold block"').status === 0);

  stage(setUp, skill('This copy works, and reports itself.', 'no secret printed, ever.').replace('More.', 'More, and more.'));
  check('a change elsewhere in the skill needs no approval', commit('fix(skills): set-up steps').status === 0);

  stage(devSkill, '# Helper\n\n**Goal:** Help, quickly.\n\nBody.\n');
  check('a development skill\'s Goal line changed with no approval is refused', commit('fix(skills): helper goal').status !== 0);
  reset();

  // A skill added or removed whole (PMM-003, PMM-007): its Goal line goes from
  // none, or to none, so it asks the same yes. One renamed with its lines kept does not.
  const newSkill = join(dir, '.claude', 'skills', 'fresh', 'SKILL.md');
  mkdirSync(dirname(newSkill), { recursive: true });
  stage(newSkill, '---\nname: fresh\n---\n\n# Fresh\n\n**Goal:** Something new.\n\nBody.\n');
  const added = commit('feat(skills): fresh (TST-001)');
  check('a skill added whole with no approval is refused', added.status !== 0 && /added whole/.test(added.stderr));
  check('a skill added whole with words he never typed is refused', commit('feat(skills): fresh (TST-001)\n\nApproved: "add whatever skills you like"').status !== 0);
  check('a skill added whole with his own words passes', commit('feat(skills): fresh (TST-001)\n\nApproved: "add that skill"').status === 0);
  git('rm', '-q', '--', newSkill);
  const removed = commit('fix(skills): retire fresh');
  check('a skill removed whole with no approval is refused', removed.status !== 0 && /removed whole/.test(removed.stderr));
  check('a skill removed whole with his own words passes', commit('fix(skills): retire fresh\n\nApproved: "retire the old one"').status === 0);
  mkdirSync(join(dir, 'archive'), { recursive: true });
  git('mv', '--', devSkill, join(dir, 'archive', 'helper.md'));
  const archived = commit('fix(skills): archive helper');
  check('a skill moved out of the skills folders with no approval is refused', archived.status !== 0 && /removed whole/.test(archived.stderr));
  reset();
  mkdirSync(join(dir, 'dev', 'skills', 'helper-two'), { recursive: true });
  git('mv', '--', devSkill, join(dir, 'dev', 'skills', 'helper-two', 'SKILL.md'));
  check('a skill renamed with its Goal line kept needs no approval', commit('fix(skills): helper renamed').status === 0);

  // CI's replay (`commit-msg --replay <before> <after>`): a commit that went
  // past the gate (--no-verify, GitHub's editor) is found after the push.
  const replay = (from, to = 'HEAD') => spawnSync(process.execPath, [join(dir, 'hooks', 'commit-msg'), '--replay', from, to], { cwd: dir, encoding: 'utf8' });
  const before = git('rev-parse', 'HEAD').trim();
  stage(specFile, `# Test [TST]\n\n${row('TST-001', 'First row, slipped past.')}`);
  git('commit', '-q', '--no-verify', '-m', 'fix(specs): TST-001 slipped past');
  const slipped = replay(before);
  check('the replay refuses a spec row changed past the gate with no approval', slipped.status !== 0 && /TST-001/.test(slipped.stderr));
  git('reset', '-q', '--hard', before);
  mkdirSync(dirname(newSkill), { recursive: true });
  stage(newSkill, '---\nname: fresh\n---\n\n# Fresh\n\n**Goal:** Something new.\n\nBody.\n');
  git('commit', '-q', '--no-verify', '-m', 'fix(skills): fresh, past the gate\n\nApproved: "add whatever skills you like"');
  const forgedPast = replay(before);
  check('the replay refuses a skill added past the gate with words he never typed', forgedPast.status !== 0 && /added whole/.test(forgedPast.stderr));
  git('reset', '-q', '--hard', before);
  stage(specFile, `# Test [TST]\n\n${row('TST-001', 'First row, approved.')}`);
  git('commit', '-q', '--no-verify', '-m', 'fix(specs): TST-001 approved\n\nApproved: "Okay, change that row"');
  check('the replay passes a commit carrying his own words', replay(before).status === 0);
  check('the replay with no known before judges the last commit alone', replay('0'.repeat(40)).status === 0);
  git('reset', '-q', '--hard', before);

  // The Transcript moved aside for one commit asks the same question.
  const aside = join(dir, 'aside');
  cpSync(join(dir, 'dev', 'dialogue'), aside, { recursive: true });
  rmSync(join(dir, 'dev', 'dialogue'), { recursive: true, force: true });
  writeFileSync(specFile, `# Test [TST]\n\n${row('TST-001', 'First row, again.')}`);
  git('add', '--', specFile);
  check('a Transcript moved off the disk for a commit fails closed', commit('fix(specs): TST-001 again\n\nApproved: "yes"').status !== 0);

  // A copy without the Transcript has no one to ask (ARC-008): the quote is only required.
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'a copy without dev/dialogue');
  stage(specFile, `# Test [TST]\n\n${row('TST-001', 'First row, once more.')}`);
  check('in a copy that has no Transcript, a quoted approval is enough', commit('fix(specs): TST-001 once more\n\nApproved: "yes"').status === 0);
  check('the commits that passed are the ones in history', git('log', '--format=%s').trim().split('\n').length === 10 && readFileSync(specFile, 'utf8').includes('once more'));

  // A first commit, every register in it: judged in a copy in use (an orphan
  // branch, the remote still there), let through as a new copy's first, which
  // new-copy.mjs starts with no history and no remote (set-up cases, 2026-10-27 · 8).
  git('remote', 'add', 'origin', 'https://example.invalid/copy.git');
  git('checkout', '-q', '--orphan', 'fresh');
  const orphan = commit('record: start again');
  check('a first commit on an orphan branch of a copy in use is judged', orphan.status !== 0 && /spec row/.test(orphan.stderr));
  git('remote', 'remove', 'origin');
  const unremoted = commit('record: start again');
  check('an orphan branch with its remote removed is still judged: the copy\'s other branches remain', unremoted.status !== 0 && /spec row/.test(unremoted.stderr));
  // A new copy as new-copy.mjs starts it: no commit, no remote, no ref of any kind.
  const fresh = makeTemp('dear-approvals-new-');
  try {
    cpSync(join(dir, 'hooks'), join(fresh, 'hooks'), { recursive: true });
    cpSync(join(dir, '.claude'), join(fresh, '.claude'), { recursive: true });
    cpSync(join(dir, 'dev'), join(fresh, 'dev'), { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: fresh });
    execFileSync('git', ['config', 'core.hooksPath', 'hooks'], { cwd: fresh });
    execFileSync('git', ['add', '-A'], { cwd: fresh });
    const first = spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', 'commit', '-q', '-m', 'record: start a new record'], { cwd: fresh, encoding: 'utf8' });
    check('a new copy\'s first commit, no history, no remote and no ref, carries its registers unjudged', first.status === 0);
  } finally {
    rmSync(fresh, { recursive: true, force: true });
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
