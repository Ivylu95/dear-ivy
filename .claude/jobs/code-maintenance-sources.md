# Code maintenance: where to look

The code-maintenance job (`code-maintenance.md`, HYG-006) holds no rule of practice of its
own. It reads these, fresh, every run, and cites the one each change comes from.
This file lists only *where to look*: what each source says lives with the
source, kept current by the people who maintain it. The job keeps the table
under **Live sources** current itself, at its weekly grounding: a source gone or
stale is swapped for the better-kept one, a better source for ground already
covered or not yet covered is added, each with its reason and date in the
grounding log (T-458). Only that table: the fence refuses an edit to anything
else in this file.

## Live sources

| Source | Covers | How to read it |
|---|---|---|
| [npm audit](https://docs.npmjs.com/cli/commands/npm-audit) (GitHub Advisory Database) | Known vulnerabilities in the dependencies | `npm audit --json` in `ux/` and `dev/ui/` |
| [npm outdated](https://docs.npmjs.com/cli/commands/npm-outdated) (the npm registry) | Dependencies with newer releases; each major version's changelog | `npm outdated --json`, then the package's release notes |
| [Knip](https://knip.dev) | Unused files, exports and dependencies across the import graph | `npm --prefix ux exec -- knip`, with nothing configured to hide findings (pinned in `ux/package.json`: an unattended run is refused a fresh download from npm, 2026-10-27; `npm outdated` keeps the pin current) |
| [jscpd](https://github.com/kucherenko/jscpd) | Copied and pasted code | `npm --prefix ux exec -- jscpd --silent --reporters json` on the code folders (pinned likewise) |
| [ESLint recommended rules](https://eslint.org/docs/latest/rules/) | Code-level mistakes and dead bindings, in every code folder, not only `ux/` | The installed ESLint, its recommended set, run across `.claude/`, `ux/` and `dev/` |
| [Node.js release schedule](https://github.com/nodejs/Release) | Which Node versions are supported, and until when | The schedule's own JSON, against `engines` and the Node in use |
| [Node.js deprecations](https://nodejs.org/api/deprecations.html) | Node APIs that are deprecated or removed | The page, and the probes run with `--pending-deprecation` |
| [Node.js CPU profiler](https://nodejs.org/api/cli.html#--cpu-prof) (`--cpu-prof`) | Speed and bottlenecks: where the code spends its time | `node ux/scripts/speed-check.mjs --slowest <baseline>` for the slowest probes, then `--profile <probe>` on the slowest few for their slowest functions in this repository's code |
| [Node.js profiling guide](https://nodejs.org/learn/getting-started/profiling) | How to read a profile, and what commonly makes Node code slow | The page, read against the functions `--profile` names |
| [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md) | Repository practices that keep dependencies and workflows safe | The checks page, read against `.github/` and the dependency files |

## The reason behind them

[ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html) names what
maintainable code is: modular, reusable, analysable, modifiable and testable. It
changes about once a decade and states no rules, so it is cited as the why,
never read as a checklist.

## The developer's own rules

The developer's standing decisions about code live in the registers, and win
over any source above where they disagree. Read these rows each run:

- `dev/specs/system/hygiene.md`: how big a file may be, how repetition is
  measured, and this job's own row (HYG-006).
- `dev/specs/system/ARCHITECTURE.md`: where each thing lives, and the scratch
  ceiling on `temp/`.
- `.claude/THRESHOLDS.md`: every number the machinery enforces, each with its row.

A rule the developer adds reaches this job by a row in a register, through a
development chat's spec step, never by an edit here.
