// Rule test for check-hygiene-fence.mjs (HYG-006): the code-maintenance job reaches
// code, dependency files and its grounding status, never the for-you list, a test, a check, the behaviour
// lock, safety or a record, and never deletes.

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probes } from './behaviour-snapshot.mjs';
import { outsideFence, safetyCited } from './check-hygiene-fence.mjs';
import { changesBetween, corePaths } from './check-only-strengthens.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const core = corePaths();
const one = (path, status = 'M') => outsideFence([{ status, path }], core);
const pkg = (fields) => JSON.stringify({ name: 'dear-dashboard', scripts: { check: 'node lib/run-checks.mjs' }, dependencies: { marked: '^14.1.2' }, ...fields }, null, 2);
const pkgChange = (before, after, path = 'ux/package.json') => outsideFence([{ status: 'M', path, before, after }], core);

check('a code file may be cleaned', ['ux/lib/views.js', 'ux/scripts/reminders.mjs', '.claude/hooks/lib/heartbeats.mjs', 'ux/src/App.tsx'].every((p) => one(p).length === 0));
check('a test is refused', one('ux/scripts/test-check-hygiene-fence.mjs').length === 1 && one('.claude/hooks/session/test-heartbeats.mjs').length === 1 && one('ux/src/app.test.ts').length === 1);
check('the checks, the gate and the selftest are refused', one('ux/scripts/check-hygiene-fence.mjs').length === 1 && one('ux/lib/checks.mjs').length === 1 && one('.claude/hooks/git/pre-commit').length === 1 && one('.claude/hooks/selftest.mjs').length === 1);
check('the specs, policies and CLAUDE.md are refused', one('dev/specs/system/hygiene.md').length === 1 && one('policies/SAFETY_POLICY.md').length === 1 && one('CLAUDE.md').length === 1);
check('a threshold is refused', one('.claude/thresholds.json').length === 1);
check('a dependency file may be upgraded', pkgChange(pkg(), pkg({ dependencies: { marked: '^15.0.0' } })).length === 0 && one('ux/package-lock.json').length === 0);
// An edge-case run of 2026-10-29: any change to ux/package.json passed, its check script rewritten to `true` with it.
check('a package.json whose scripts changed is refused', pkgChange(pkg(), pkg({ scripts: { check: 'true' } })).length === 1);
check('a package.json gaining a field outside its dependencies is refused', pkgChange(pkg(), pkg({ bin: { x: 'x.mjs' } })).length === 1);
check('every dependency field may move', pkgChange(pkg(), pkg({ dependencies: {}, devDependencies: { a: '1' }, peerDependencies: { b: '2' }, optionalDependencies: { c: '3' }, overrides: { d: '4' } })).length === 0);
check('a package.json that cannot be read is refused', pkgChange(undefined, pkg()).length === 1 && pkgChange(pkg(), '{ not json').length === 1);
check('a package.json added holding only dependencies passes, one with more is refused', pkgChange(null, JSON.stringify({ dependencies: { a: '1' } }), 'dev/ui/package.json').length === 0 && pkgChange(null, pkg()).length === 1);
// A-152: the job fixes or drops what it finds; a question goes in its reply, never the list.
check('the for-you list is refused', one('dev/for-you.md').length === 1);
check('the weekly grounding status may be kept', one('.claude/jobs/code-maintenance-grounding.md').length === 0);
// T-458: the job keeps its own list of sources current, the table only.
const SRC = '.claude/jobs/code-maintenance-sources.md';
const srcText = (table, rules = '- dev/specs/system/hygiene.md\n') => `# Code maintenance: where to look\n\nIntro.\n\n## Live sources\n\n${table}\n## The reason behind them\n\nWhy.\n\n## The developer's own rules\n\n${rules}`;
const srcChange = (before, after) => outsideFence([{ status: 'M', path: SRC, before, after }], core);
check('the job may add, swap or drop a row of its sources table', srcChange(srcText('| a | x | y |\n'), srcText('| a | x | y |\n| b | speed | z |\n')).length === 0 && srcChange(srcText('| a | x | y |\n'), srcText('| c | x | y |\n')).length === 0);
check("the developer's own rules in the sources file are refused", srcChange(srcText('| a |\n'), srcText('| a |\n', '- nothing binds\n')).length === 1);
check('the intro or the reason behind the sources is refused', srcChange(srcText('| a |\n'), srcText('| a |\n').replace('Why.', 'Because.')).length === 1 && srcChange(srcText('| a |\n'), srcText('| a |\n').replace('Intro.', 'Anything goes.')).length === 1);
check('a sources file with its table removed, doubled, or unreadable is refused', srcChange(srcText('| a |\n'), srcText('| a |\n').replace('## Live sources', '## Sources')).length === 1 && srcChange(srcText('| a |\n'), srcText('| a |\n') + '## Live sources\n\n| z |\n').length === 1 && srcChange(undefined, srcText('| a |\n')).length === 1 && one(SRC).length === 1);
check('the real sources file reads as one table and the rest', (() => { const t = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', SRC), 'utf8'); return srcChange(t, t.replace('## Live sources\n', '## Live sources\n\n<!-- grounded -->\n')).length === 0; })());
check('the speed check, which judges a change, is refused', one('ux/scripts/speed-check.mjs').length === 1);
check('the behaviour lock, its watch and its ledger are refused', one('ux/scripts/behaviour-snapshot.mjs').length === 1 && one('ux/scripts/upkeep-watch.mjs').length === 1 && one('.claude/jobs/code-maintenance-snapshot.json').length === 1);
check('deleting a dependency file or the grounding status is refused', one('ux/package.json', 'D').length === 1 && one('.claude/jobs/code-maintenance-grounding.md', 'D').length === 1);
check('the record, sample and sandbox are refused', one('data/core/now.js').length === 1 && one('data-sample/x.mjs').length === 1 && one('data-sandbox/x.mjs').length === 1);
check('a file on the safety surface is refused', core.filter((k) => !k.endsWith('/')).every((p) => one(p).length === 1));
check('a prose file is refused', one('.claude/skills/commit/SKILL.md').length === 1 && one('.claude/jobs/dev-hygiene.md').length === 1);
check('deleting or renaming code is refused', one('ux/lib/views.js', 'D').length === 1 && one('ux/lib/views.js', 'R100').length === 1);

// An edge-case run of 2026-10-29: a binary file with a code extension passed, and the lock cannot see it.
check('a binary file is refused, whatever its extension', outsideFence([{ status: 'A', path: 'ux/lib/blob.js', binary: true }], core).length === 1);
{
  const dir = makeTemp('dear-fence-');
  try {
    const git = (...a) => execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    writeFileSync(join(dir, 'a.js'), 'x\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    writeFileSync(join(dir, 'blob.js'), Buffer.from([0, 1, 2, 0, 255, 0]));
    git('add', '.');
    git('commit', '-qm', 'binary');
    const changes = changesBetween('HEAD~1', 'HEAD', dir);
    check('a binary file is read as binary from git, and refused', changes.length === 1 && changes[0].binary === true && outsideFence(changes, core).length === 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// An edge-case run of 2026-10-29: dev/ui/scripts/test.mjs, the lock's admin unit-test probe, passed the fence.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runners = new Set(['dev/ui/scripts/test.mjs', 'ux/test/run.mjs']);
for (const p of probes()) for (const a of p.cmd.slice(1)) if (/\.mjs$/.test(a)) runners.add(relative(REPO, resolve(p.cwd, a)).replace(/\\/g, '/'));
check(`every probe runner the lock runs is refused (${runners.size})`, [...runners].every((r) => one(r).length === 1));
check('the admin unit-test runner is refused', one('dev/ui/scripts/test.mjs').length === 1);

// T-330: the fence read only subjects for a safety row; check-only-strengthens reads bodies.
check('a safety row cited in a subject is refused', safetyCited(['fix(x): per SAF-001']).length === 1);
check('a safety row cited only in the body is refused', safetyCited(['chore(deps): bump a tool\n\nAlso loosens SPL-002.\n\nUpkeep: HYG-006']).length === 1);
check('a commit citing none passes', safetyCited(['chore(deps): bump a tool\n\nUpkeep: HYG-006']).length === 0);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
