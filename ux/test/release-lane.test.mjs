// A release never carries the record (DEP-009): the harness reaches her copy
// without anyone gaining the record, so a release with any file under data/ is
// refused by the copy's own lane check before anything is applied. The
// end-to-end flow is dev/skills/release/test-release.mjs; this holds the rule
// itself in the gate, where that flow is too slow to run.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { touchable, NEVER_TOUCH } from '../../.claude/hooks/lib/update/release-lib.mjs';

const hooks = join(import.meta.dirname, '..', '..', '.claude', 'hooks', 'lib', 'update');

describe('what a release may not carry (DEP-009)', () => {
  test('every place the record lives is refused', () => {
    for (const p of ['data/PROFILE.yaml', 'data/core/timeline.md', 'data/core/journal/2026-10-01.md', 'data/safety/safety_plan.md', 'data/therapy/x.md', 'data/archive/old.md', 'data-sandbox/x.md']) {
      assert.equal(touchable(p), false, `${p} must be refused`);
    }
  });
  test('git, secrets and her local layer are refused too', () => {
    for (const p of ['.git/config', '.env', '.claude/skills/local-mine/SKILL.md', '.claude/release/installed.json']) {
      assert.equal(touchable(p), false, `${p} must be refused`);
    }
  });
  test('harness files are still allowed', () => {
    for (const p of ['CLAUDE.md', '.claude/hooks/session/session-brief.mjs', 'ux/lib/checks.mjs', 'modules/core/knowledge/practices.md']) {
      assert.equal(touchable(p), true, `${p} must pass`);
    }
  });
  test('the rule for the record is not dropped from the list', () => {
    assert.ok(NEVER_TOUCH.some((re) => re.test('data/core/x.md')));
  });
  test('the updater refuses a release on that rule before it applies anything', () => {
    const source = readFileSync(join(hooks, 'update.mjs'), 'utf8');
    assert.match(source, /if \(!touchable\(f\)\) fail\('lane'/);
  });
  // The build is the developer's (dev/skills/release/); a copy without dev/
  // (ARC-008) builds no release, so there is nothing of it to hold.
  const release = join(import.meta.dirname, '..', '..', 'dev', 'skills', 'release', 'release.mjs');
  const devless = !existsSync(join(import.meta.dirname, '..', '..', 'dev'));
  test('the build refuses a candidate holding what a copy may not take, in CI as well as at prepare', { skip: devless && 'no dev/ in this copy (ARC-008)' }, () => {
    const source = readFileSync(release, 'utf8');
    const build = source.slice(source.indexOf('export function buildCandidate'), source.indexOf('export function', source.indexOf('export function buildCandidate') + 10));
    assert.match(build, /touchable\(/, 'buildCandidate must refuse files the updater would refuse');
    assert.match(build, /throw new Error|die\(/);
  });
});
