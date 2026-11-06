---
last_grounded: 2026-11-02
next_due: 2026-11-09
every: 7 days
---
# Code maintenance: grounding

Once a week the code-maintenance job (`code-maintenance.md`, HYG-006) checks that the
sources it reads every night still deserve to be read: each link alive, each
source still maintained, none replaced, and no better-kept source for the same
ground. This file is that check's status and its log. The job writes this
file's frontmatter, adds lines to the log, and makes what a grounding finds in
the **Live sources** table of [`code-maintenance-sources.md`](code-maintenance-sources.md)
itself: a source swapped, added or dropped, its log line saying why (T-458).

**Status:** `never` (not yet run) · `ok` (every source holds) · `attention` (a
source does not hold; the reply names it) · `failed` (the check could not
be done; the reply says why).

## Log

One line per source per grounding, newest first:
`YYYY-MM-DD · <source> · holds | stale | replaced | gone | added · <what was found, and where>`
2026-11-02 · npm audit · holds · docs.npmjs.com pages live through v12; one WebSearch (the proxy refuses docs.npmjs.com directly)
2026-11-02 · npm outdated · holds · docs.npmjs.com pages live through v12; one WebSearch
2026-11-02 · Knip · holds · search found only aggregator pages; the npm registry shows 6.44.1 published 2026-10-31, so it is maintained
2026-11-02 · jscpd · holds · v5.0.x Rust engine releases on GitHub per aggregator pages; npm registry jscpd 5.4.2, modified 2026-10-20
2026-11-02 · ESLint recommended rules · holds · search found no official page, but the npm registry shows eslint 10.14.0 published 2026-10-30; rules page refused by the proxy, not gone
2026-11-02 · Node.js release schedule · holds · schedule.json on raw.githubusercontent.com live: 22 in maintenance to 2027-04-30, 26 LTS from 2026-10-28
2026-11-02 · Node.js deprecations · holds · nodejs.org/api/deprecations.html answers 200 and is current
2026-11-02 · Node.js CPU profiler · holds · nodejs.org/api/cli.html answers 200; --cpu-prof still documented
2026-11-02 · Node.js profiling guide · holds · nodejs.org/learn/getting-started/profiling answers 200; the diagnostics/poor-performance page covers the same ground
2026-11-02 · OpenSSF Scorecard checks · holds · docs/checks.md in ossf/scorecard named in search as the check reference; github.com refused by the proxy, not gone
2026-10-26 · npm audit · holds · docs.npmjs.com pages live through v12; one WebSearch
2026-10-26 · npm outdated · holds · docs.npmjs.com pages live through v12; one WebSearch
2026-10-26 · Knip · holds · knip.dev still maintained; search could not confirm the latest release date, only aggregator pages
2026-10-26 · jscpd · holds · github.com/kucherenko/jscpd maintained, v5.0.x Rust engine (v5.0.11 dated 2026-06-20)
2026-10-26 · ESLint recommended rules · holds · eslint.org live; v9 end-of-life 2026-08-06, already in the backlog
2026-10-26 · Node.js release schedule · holds · nodejs.org announcement live; 26 enters LTS October 2026, one major a year from 27
2026-10-26 · Node.js deprecations · holds · nodejs.org/api/deprecations live and current
2026-10-26 · OpenSSF Scorecard checks · holds · docs/checks.md in ossf/scorecard live and maintained
2026-10-19 · npm audit · holds · docs.npmjs.com page live, v12 page current; one WebSearch
2026-10-19 · npm outdated · holds · docs.npmjs.com page live, v12 page current; one WebSearch
2026-10-19 · Knip · holds · knip.dev maintained; search could not confirm the latest release date; its run reports imports through the app path alias as unresolved here, so unused-file findings are noise without a config
2026-10-19 · jscpd · holds · github.com/kucherenko/jscpd maintained (v5.x, Rust engine, release about 2026-06); v4 stays on master-v4; `npx jscpd` now installs 5.4.1
2026-10-19 · ESLint recommended rules · holds · eslint.org live; v9 line reached end-of-life 2026-08-06 and ux/ is on 9.39.5 (latest 10.13.0), a backlog line names it
2026-10-19 · Node.js release schedule · holds · github.com/nodejs/Release live; from 27.x one major a year, 26 is the last on the old model
2026-10-19 · Node.js deprecations · holds · nodejs.org/api/deprecations live and current
2026-10-19 · OpenSSF Scorecard checks · holds · docs/checks.md in ossf/scorecard live and maintained
