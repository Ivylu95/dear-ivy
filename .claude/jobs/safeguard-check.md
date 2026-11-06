---
emoji: 🛡️
runs: local
every: 1 day
governs: SFG-009 and SFG-013 in dev/specs/system/safeguards.md
---
# Heartbeat: safeguard check

Renamed from *safeguards* on 2026-10-30, the owner's word (T-451): it checks every safeguard, and restores one that stopped.

An unattended run, in a fresh session with no one present. It serves
`SFG-009`, *"A safeguard that has stopped working is noticed and restored to
what the specs require, without anyone looking."*, and `SFG-013`, *"Nothing
counts as a safeguard until it has been seen to refuse what it exists to
refuse."* The commit gate and session start already catch a dead safeguard;
this run is the one that restores it, between sessions, when no one is there to
act on the warning.

1. Run `node .claude/hooks/selftest.mjs`. If it ends *all hooks alive and
   deciding*, and every hook it tested is wired in `.claude/settings.json` as
   the specs require, go to step 5.
2. For each failing safeguard, find its last committed version that passed:
   walk back through `git log -- <file>`, check each version out into a copy
   under `temp/`, and run the selftest there, never on the working tree. A git
   hook counts only if it passes as committed, executable bit included.
3. Restore the file from that version with an ordinary new commit (never a
   reset, a revert of someone else's history, or a force-push), run the
   selftest again, and push only if it now passes. One safeguard, one commit,
   its body naming the failing case, the version restored and the test result
   (`SFG-009`). Nothing in `CORE` of
   `.claude/hooks/safety/guard-safety-core.mjs` is restored this way: that
   needs the developer's unlock, so it is reported instead.
4. What it cannot restore, because no version passed, the file is in the
   safety core, or the specs do not say how it should be wired, it reports and
   leaves: open one GitHub issue per safeguard titled `Dead safeguard: <file>`,
   saying which case fails and why no restore was made, unless one is already
   open for it (`DEV-013`).
5. Record the outcome: `node .claude/hooks/lib/heartbeats.mjs finish safeguard-check ok`, or `failed` if the run could not do its job (`HBT-004`, `HBT-008`). A run started by hand claims first with `claim safeguard-check`, from a checkout of its own, never the tree a conversation saves from (`HBT-007`). The claim is a commit, so it passes the commit gate: install `ux`'s packages in that checkout first (`npm --prefix ux ci`), or the gate refuses it.

Never during one of her conversations, never touching `data/`, and never
loosening a check or a case to make it pass: a safeguard is restored to what
its test demands, never the test to what the safeguard does. Nothing personal
in a commit, an issue or a file name.
