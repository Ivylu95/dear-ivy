// Rule test for git/commit-msg's copy rule (A-155, ARC-004): a commit message line
// of 60 characters or more whose words, quote and list markers aside, are a line of
// the record is refused, as the privacy check refuses one in a file; the refusal
// names the message's line, never the line itself or a path. A template's line, a
// short line and a long line of the message's own pass. Replayed in a throwaway
// tree with an invented record and the real hook and check. Run by the hook self-test.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const dir = makeTemp('dear-msg-copies-');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/i.test(k)));

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${detail.slice(0, 300)}`}`);
};

const QUOTE = 'Walked the long way home along the canal and felt lighter by the bridge.';
const BLANK = 'Write here what the day held, in your own words, as long or short as it was.';
try {
  // Its own repository, so the hook's root is this tree wherever the temp folder sits.
  spawnSync('git', ['init', '-q'], { cwd: dir, env });
  mkdirSync(join(dir, '.claude', 'hooks'), { recursive: true });
  cpSync(join(here), join(dir, '.claude', 'hooks', 'git'), { recursive: true });
  cpSync(join(here, '..', 'lib'), join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
  mkdirSync(join(dir, 'ux', 'scripts'), { recursive: true });
  cpSync(join(repo, 'ux', 'scripts', 'check-privacy.mjs'), join(dir, 'ux', 'scripts', 'check-privacy.mjs'));
  cpSync(join(repo, 'ux', 'lib'), join(dir, 'ux', 'lib'), { recursive: true });
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  put('data/PROFILE.yaml', 'mandatory:\n  name:\n    value: Person-J\n    status: answered\n');
  put('data/core/journal/2026-01-02.md', `# A walk\n\n> ${QUOTE}\n\n${BLANK}\n`);
  put('modules/core/templates/blank-record/core/journal/entry.md', `# Entry\n\n${BLANK}\n`);

  const msg = (text) => {
    const file = join(dir, `msg-${Math.random().toString(36).slice(2)}`);
    writeFileSync(file, text);
    return spawnSync(process.execPath, [join(dir, '.claude', 'hooks', 'git', 'commit-msg'), file], { cwd: dir, encoding: 'utf8', env: { ...env, CLAUDE_PROJECT_DIR: dir } });
  };

  let r = msg(`fix(ux): a note\n\n${QUOTE}\n`);
  check('a line of the record in a body is refused', r.status === 1 && /line 3 of this message repeats a line from the record/.test(r.stderr), r.stderr);
  check('the refusal never echoes the line, nor names a path', !r.stderr.includes(QUOTE) && !r.stderr.includes('data/'), r.stderr);
  r = msg(`fix(ux): a note\n\n> ${QUOTE}\n`);
  check('the same line quoted with "> " is refused', r.status === 1 && /repeats a line from the record/.test(r.stderr), r.stderr);
  r = msg(`fix(ux): a note\n\n- ${QUOTE}\n`);
  check('the same line as a list item is refused', r.status === 1 && /repeats a line from the record/.test(r.stderr), r.stderr);
  r = msg(`fix(ux): a note\n\n${BLANK}\n`);
  check("a blank template's line, which the record was built from, passes", r.status === 0, r.stderr);
  r = msg('fix(ux): a note\n\nA long line of the message\'s own, about the gate and nothing of hers.\n');
  check('a long line of its own passes', r.status === 0, r.stderr);
  r = msg('fix(ux): along the canal\n');
  check('a short fragment passes: shorter than 60 characters is coincidence', r.status === 0, r.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log('commit-msg copies test: all passed');
