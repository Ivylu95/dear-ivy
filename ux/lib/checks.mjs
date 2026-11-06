// Every check, in one list, each saying where it runs (SFG-007 design 4, "One
// list of checks is read by the commit gate, by `npm run check` and by a
// workflow on every push to main, each entry saying where it runs").
//
//   gate   the commit gate, .claude/hooks/git/pre-commit, against the staged tree
//   local  `npm run check` (lib/run-checks.mjs)
//   ci     the workflow on every push, .github/workflows/checks.yml, which checks
//          out everything but data/
//
// The gate and `npm run check` kept a list each, and they drifted: about ten
// checks ran in one only, and lint ran in neither (design audit, 2026-10-08).
// A check stays off the gate when it is slow, or not a property of the commit
// (timings, scratch); off CI when it needs her record, which CI never has: the
// privacy, name and profile checks find nothing to compare there, and the
// crisis numbers, links and the selftest read files under data/.
//
// `script` is from the repository root; `cwd` is where it runs, ux/ by default;
// `prepare`, a script run first. `limitMs` is the gate's time limit, a minute
// unless given. The gate runs its checks side by side (T-841); `alone`, a check
// that times itself, keeps every processor busy or writes into the staged copy,
// runs after them with nothing beside it.

export const CHECKS = [
  { name: 'crisis numbers', script: 'ux/scripts/check-safety.mjs', gate: true, local: true },
  // 868 harness files against 7 names / 1M+ record lines took > 60s on 2026-10-08.
  { name: 'privacy', script: 'ux/scripts/check-privacy.mjs', gate: true, local: true, limitMs: 120000 },
  { name: 'policies', script: 'ux/scripts/check-policies.mjs', gate: true, local: true, ci: true },
  { name: 'profile', script: '.claude/hooks/record/check-profile.mjs', args: ['--all'], gate: true },
  { name: 'links', script: 'ux/scripts/check-links.mjs', gate: true, local: true },
  // WKB-007 design 9: the Agreements match the Transcript they are generated from.
  { name: 'dialogue', script: 'ux/scripts/dialogue.mjs', args: ['check'], gate: true, local: true, ci: true },
  // WKB-007 design 10: the dialogue checks, each proven against an invented Transcript.
  { name: 'dialogue test', script: 'ux/scripts/test-dialogue.mjs', gate: true, local: true, ci: true },
  // T-822: a merge rebuilt ~45 generated pages at ~14 s each; kept lines make them fast, unchanged.
  // Alone at the gate: it times itself, and beside the selftest took 5 s against its 3 (T-841).
  // A-171: a passage the developer flagged hard to read is rewritten by the next check.
  { name: 'hard to read', script: 'ux/scripts/check-hard-to-read.mjs', local: true, ci: true },
  { name: 'hard to read test', script: 'ux/scripts/test-hard-to-read.mjs', gate: true, local: true, ci: true },
  { name: 'dialogue speed test', script: 'ux/scripts/test-dialogue-speed.mjs', gate: true, local: true, ci: true, alone: true },
  { name: 'agreement parts test', script: 'ux/scripts/test-agreement-parts.mjs', gate: true, local: true, ci: true, limitMs: 120000 },
  { name: 'dialogue behind test', script: 'ux/scripts/test-dialogue-behind.mjs', gate: true, local: true, ci: true },
  // WKB-007 design 11: the history reads whole across its day files and parts.
  { name: 'eval history test', script: 'ux/scripts/test-eval-history.mjs', gate: true, local: true, ci: true },
  { name: 'fitness test', script: 'modules/fitness/scripts/test-fitness.mjs', gate: true, local: true, ci: true },
  { name: 'stray folders test', script: 'ux/scripts/test-modules-stray.mjs', gate: true, local: true, ci: true },
  // WKB-007 design 11: every eval card answers the six questions from the closed sets (D49).
  { name: 'evals', script: 'ux/scripts/evals.mjs', args: ['check'], gate: true, local: true, ci: true },
  { name: 'evals test', script: 'ux/scripts/test-evals.mjs', gate: true, local: true, ci: true },
  // WKB-007: every path a spec row's design column names exists.
  { name: 'spec paths', script: 'ux/scripts/check-spec-paths.mjs', gate: true, local: true, ci: true },
  // PMM-008: every skill and command header parses and is described.
  { name: 'skill headers', script: 'ux/scripts/check-skills.mjs', gate: true, local: true, ci: true },
  // DEP-014 design 3: the set-up skill's line and word limits.
  { name: 'setup size test', script: 'ux/scripts/test-setup-size.mjs', gate: true, local: true, ci: true },
  { name: 'skill size test', script: 'ux/scripts/test-skill-size.mjs', gate: true, local: true, ci: true },
  // PMM-015, PMM-017, PMM-018: every skill and command within the practice cache's limits.
  { name: 'procedures', script: 'ux/scripts/check-procedures.mjs', gate: true, local: true, ci: true },
  { name: 'procedures test', script: 'ux/scripts/test-check-procedures.mjs', gate: true, local: true, ci: true },
  // PMM-010, PMM-011: every skill's tests well formed, and the unproven list current. Offline only.
  { name: 'skill evals', script: 'ux/scripts/check-skills.mjs', args: ['--evals', '--check'], gate: true, local: true, ci: true },
  { name: 'skill evals test', script: 'ux/scripts/test-skill-evals.mjs', gate: true, local: true, ci: true },
  // PRL-001, PRL-002: in her copy a procedure cannot be changed, removed or moved out on the agent's word.
  { name: 'harness lock test', script: '.claude/hooks/record/test-harness-lock.mjs', gate: true, local: true, ci: true },
  // FND-008: every piece of machinery is claimed by a row.
  { name: 'claimed', script: 'ux/scripts/check-claimed.mjs', gate: true, local: true, ci: true },
  // CTX-001: the always-loaded instructions never grow past their ceiling.
  { name: 'context size', script: 'ux/scripts/check-context-size.mjs', gate: true, local: true, ci: true },
  { name: 'context size test', script: 'ux/scripts/test-check-context-size.mjs', gate: true, local: true, ci: true },
  // FND-009: the thresholds files say what the rows say.
  { name: 'thresholds', script: 'ux/scripts/thresholds.mjs', args: ['--check'], gate: true, local: true, ci: true },
  // WKB-007, ARC-008: the statements the reply check reads say what the rows say.
  { name: 'spec statements', script: 'ux/scripts/spec-statements.mjs', args: ['--check'], gate: true, local: true, ci: true },
  // SFG-007: an index range or a row group left behind when a row is added.
  { name: 'spec ranges', script: 'ux/scripts/spec-lint.mjs', args: ['--only', 'index-prefix,index-range,groups,coverage,note-last,lead'], gate: true, local: true, ci: true },
  { name: 'spec lint test', script: 'ux/scripts/test-spec-lint.mjs', local: true, ci: true },
  { name: 'only-strengthens test', script: 'ux/scripts/test-only-strengthens.mjs', local: true, ci: true },
  { name: 'doctor fence test', script: 'ux/scripts/test-check-doctor-fence.mjs', local: true, ci: true },
  { name: 'hygiene fence test', script: 'ux/scripts/test-check-hygiene-fence.mjs', local: true, ci: true },
  // HYG-002: what is kept whole is exact, named, and nothing else drops out.
  { name: 'hygiene size test', script: 'ux/scripts/test-check-hygiene.mjs', local: true, ci: true },
  { name: 'behaviour lock test', script: 'ux/scripts/test-behaviour-snapshot.mjs', local: true, ci: true },
  { name: 'upkeep watch test', script: 'ux/scripts/test-upkeep-watch.mjs', local: true, ci: true },
  { name: 'restore drill test', script: 'ux/scripts/test-restore-drill.mjs', local: true, ci: true },
  { name: 'record paths', script: 'ux/scripts/check-record-paths.mjs', gate: true, local: true, ci: true },
  // MEM-007: the invented timelines run in order of when things happened, never her record.
  { name: 'timeline order', script: 'ux/scripts/check-timeline-order.mjs', gate: true, local: true, ci: true },
  { name: 'timeline order test', script: 'ux/scripts/test-check-timeline-order.mjs', gate: true, local: true, ci: true },
  // The invented record shows every module, view and record shape.
  { name: 'sample', script: 'ux/scripts/check-sample.mjs', gate: true, local: true, ci: true },
  // A-152, DEV-013, DEV-014: a line not in the for-you format is work kept that should be finished or dropped, or a question the menu never shows.
  { name: 'for you', script: 'ux/scripts/check-for-you.mjs', gate: true, local: true, ci: true },
  // SFG-011: no script or unattended prompt runs a git command the guard refuses.
  { name: 'git bypass', script: 'ux/scripts/check-git-bypass.mjs', gate: true, local: true, ci: true },
  { name: 'git bypass test', script: 'ux/scripts/test-check-git-bypass.mjs', gate: true, local: true, ci: true },
  // WKB-007: an eval or agreement ID made here is not taken on main by something else (2026-10-29).
  { name: 'id clash', script: 'ux/scripts/check-id-clash.mjs', gate: true, local: true },
  { name: 'id clash test', script: 'ux/scripts/test-check-id-clash.mjs', gate: true, local: true, ci: true },
  // DEV-016: everything git-reconcile leaves comes with why and a copyable git command.
  { name: 'git reconcile test', script: 'ux/scripts/test-git-reconcile.mjs', gate: true, local: true, ci: true },
  // PRV-003: no access key in any file the commit carries.
  { name: 'secrets', script: 'ux/scripts/check-secrets.mjs', gate: true, local: true, ci: true },
  // SFG-007 design 5: each check proven against a tree made for it.
  { name: 'privacy test', script: 'ux/scripts/test-check-privacy.mjs', gate: true, local: true, ci: true },
  // ARC-004 design 4: the ledger of what the privacy read has read, and the share and release refusals on it.
  { name: 'privacy ledger test', script: 'ux/scripts/test-privacy-ledger.mjs', gate: true, local: true, ci: true },
  // A job's own agent cannot start agents (.claude/jobs/README.md step 3): a job prompt asking it to is refused.
  { name: 'job agents', script: 'ux/scripts/check-job-agents.mjs', gate: true, local: true, ci: true },
  { name: 'job agents test', script: 'ux/scripts/test-check-job-agents.mjs', gate: true, local: true, ci: true },
  // ARC-004 designs 3 and 4: a share copy is refused unless all three privacy conditions hold.
  { name: 'share test', script: 'dev/skills/release/test-share.mjs', gate: true, local: true, ci: true },
  { name: 'release ship test', script: 'dev/skills/release/test-ship.mjs', gate: true, local: true, ci: true },
  // DEV-004 design 4: every logo the see-it skill inlines, on either route, is clean, listed and as vetted.
  // It ships with the skill, so it runs in a copy without dev/ too (ARC-008).
  { name: 'see-it logos', script: '.claude/skills/see-it/scripts/check-logos.mjs', gate: true, local: true, ci: true },
  { name: 'see-it logos test', script: '.claude/skills/see-it/scripts/test-check-logos.mjs', gate: true, local: true, ci: true },
  // FIT-005 design 2 (A-168): both see-it pages answer a tap; the browser taps run where playwright is installed.
  // CON-022 (A-171): the sentence check flags what a count can see and passes plain writing.
  { name: 'prose test', script: 'ux/scripts/test-prose.mjs', gate: true, local: true, ci: true },
  // A-178: the for-you list holds questions only, once each; the weekly short list settles only what he left, never at a gate.
  { name: 'for-you week test', script: 'ux/scripts/test-for-you-week.mjs', gate: true, local: true, ci: true },
  { name: 'see-it tap test', script: 'dev/skills/see-it/test-tap.mjs', local: true, ci: true },
  // FIT-005 design 2 (T-773): a tap answers on screen, in a sheet at the foot, and lights the whole route.
  { name: 'see-it tap route test', script: 'dev/skills/see-it/test-tap-route.mjs', local: true, ci: true },
  // ARC-004: no harness example is a first name, so none stops a copy whose record
  // holds the same name (dev/skills/set-up/cases.md, 2026-10-27). It reads no record.
  { name: 'example names test', script: 'ux/scripts/test-example-names.mjs', gate: true, local: true, ci: true },
  { name: 'links test', script: 'ux/scripts/test-check-links.mjs', gate: true, local: true, ci: true },
  // SFG-005 design 1: a broken pointer or uncited row is reported as the file is written.
  { name: 'write links test', script: '.claude/hooks/record/test-write-links.mjs', gate: true, local: true, ci: true },
  { name: 'secrets test', script: 'ux/scripts/test-check-secrets.mjs', gate: true, local: true, ci: true },
  // WKB-002, ARC-008: the developer's views stay in dev/ui, and ux/ never imports from it.
  { name: 'admin split', script: 'dev/ui/scripts/check-split.mjs', gate: true, ci: true },
  // CHG-007, CHG-008: the admin app's tests, against throwaway repositories.
  { name: 'admin tests', script: 'dev/ui/scripts/test.mjs', gate: true, local: true, ci: true },
  // DPV-009: nothing in the repository opens a public way in to the interface.
  { name: 'remote', script: 'ux/scripts/check-remote.mjs', gate: true, local: true, ci: true },
  { name: 'remote test', script: 'ux/scripts/test-check-remote.mjs', gate: true, local: true, ci: true },
  // DEP-014: the setup doctor reads each state from evidence, and prints none of the record.
  { name: 'setup doctor test', script: 'ux/scripts/test-setup-doctor.mjs', gate: true, local: true, ci: true },
  // DEP-015: the README's download step makes a fresh clone a new copy, and refuses a copy in use.
  { name: 'new copy test', script: 'ux/scripts/test-new-copy.mjs', gate: true, local: true, ci: true },
  // DEP-015, ARC-008: a new copy's first commit passes the real gate, for each answer of --for.
  // Off the gate and CI: it runs the whole gate twice, about two minutes.
  { name: 'first commit test', script: 'ux/scripts/test-first-commit.mjs', local: true },
  // DEP-009: the release flow end to end, a person's updater against good and bad
  // releases, going back, and a first install (edge cases, 2026-10-29: B3, B5-B10).
  // Off the gate and CI: it test-runs each release, about four minutes.
  { name: 'release test', script: 'dev/skills/release/test-release.mjs', local: true },
  // STK-001, STK-002: the tech stack view names every dependency, and nothing else.
  { name: 'tech stack', script: 'ux/scripts/check-tech-stack.mjs', gate: true, local: true, ci: true },
  // DES-007: the name on screen is the record's, never the sign-in account.
  { name: 'shown name', script: 'ux/scripts/check-shown-name.mjs', gate: true, local: true },
  // DES-001 design 3: no view writes a shared component's class by hand.
  { name: 'shared parts', script: 'ux/scripts/check-shared-parts.mjs', gate: true, local: true, ci: true },
  { name: 'shared parts test', script: 'ux/scripts/test-check-shared-parts.mjs', gate: true, local: true, ci: true },
  // The dashboard's unit tests: dates, markdown, and the read layer against the
  // invented record (data-sample/), never hers.
  { name: 'unit tests', script: 'ux/test/run.mjs', gate: true, local: true, ci: true },
  // The name match behind timeline mentions and the safety plan's dial row.
  { name: 'name match test', script: 'ux/scripts/test-name-match.mjs', gate: true, local: true, ci: true },
  { name: 'config', script: 'ux/scripts/check-config.mjs', gate: true, local: true, ci: true },
  { name: 'record names', script: 'ux/scripts/check-record-names.mjs', gate: true, local: true },
  // These two list files with `git ls-files`, and the gate's snapshot has no .git.
  { name: 'folder index', script: 'ux/scripts/check-folder-index.mjs', local: true, ci: true },
  { name: 'modules', script: 'ux/scripts/modules.mjs', args: ['--check'], gate: true, local: true, ci: true },
  { name: 'perimeter', script: 'ux/scripts/check-perimeter.mjs', gate: true, local: true, ci: true },
  { name: 'retired terms', script: 'ux/scripts/check-retired-terms.mjs', gate: true, local: true, ci: true },
  { name: 'control bytes', script: 'ux/scripts/check-control-bytes.mjs', local: true, ci: true },
  // Lint, both apps: the dashboard's config serves the admin app too.
  { name: 'lint', script: 'ux/node_modules/eslint/bin/eslint.js', args: ['.'], local: true, ci: true },
  // The admin app resolves its packages through a link to ux/'s, made first.
  { name: 'admin lint', script: 'ux/node_modules/eslint/bin/eslint.js', args: ['--config', '../../ux/eslint.config.mjs', 'app', 'components', 'lib', 'proxy.js'], cwd: 'dev/ui', prepare: 'dev/ui/scripts/link-deps.mjs', local: true, ci: true },
  // Reports about this machine, not properties of a commit.
  { name: 'scratch', script: 'ux/scripts/check-scratch.mjs', local: true },
  // WKB-004: a failing check is never left to become normal. This one failed for
  // weeks off the gate (2026-09-30 to 2026-10-13), so it runs at commit too; her
  // own saves are record-only commits, which the gate passes before any check.
  { name: 'sandbox', script: 'ux/scripts/sandbox.mjs', args: ['check'], gate: true, local: true },
  // Every developer view's server work against one budget (DES-008).
  { name: 'speed', script: 'ux/scripts/check-speed.mjs', local: true },
  // The same timing on every push (DES-008 design 2); it reads no record, so CI can run it.
  { name: 'speed in ci', script: 'ux/scripts/check-speed.mjs', ci: true },
  // SFG-013: every safeguard is seen to refuse what it exists to refuse. Alone and last
  // at the gate (T-841): it runs its own tests side by side across every processor, and
  // writes state files into the staged copy the other checks read.
  { name: 'hooks selftest', script: '.claude/hooks/selftest.mjs', gate: true, limitMs: 240000, alone: true },
];

/** The checks for one runner: 'gate', 'local' or 'ci'. */
export const checksFor = (where) => CHECKS.filter((c) => c[where]);
