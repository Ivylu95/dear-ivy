# Two separate locks guard the safety core

**Seen 2026-10-20.** The developer typed the unlock, and the repository's own unlock hook confirmed
it: "unlocked for two hours". The very next edit to a core file was still refused, this time by
Claude Code's own permission classifier ("Security Weaken"), which then refused a plain read of the
same files too. The edit put the new banner on the two safety spec files and removed an allowance
in the banner check. That tightened the check, but deleting checker code reads to the classifier as
weakening it.

- **The repository's unlock opens only the repository's guard.** The platform's permission system
  is separate, belongs to the developer, and no phrase typed in chat opens it.
- **When the classifier refuses, stop.** Don't rephrase the command or reach for another tool to
  get round it. Say plainly what was being changed and why, and give the developer three choices:
  switch the chat out of auto mode and have it retried, do it themselves, or leave it.
- **In auto mode nobody is asked.** Seen again 2026-10-21: the owner said yes twice in chat to a
  commit-hook change outside the safety core, and the classifier refused it both times ("Security
  Weaken", then "Self-Modification"). Any edit that makes a guard ask for less is refused there,
  core or not. Never promise "you'll be asked to approve it": the way through is a mode that asks
  before edits (chosen in the app, often only on a computer), or the developer's own edit. Keep the
  exact change in a desk draft so nothing is lost while it waits.
- **The unlock phrase only counts at the very start of a message the developer types.** Typed at the
  end of a longer message it does nothing, by design. Tell them the exact form when they ask to
  unlock.

**A non-safety line in the hook settings is edited with the Edit tool** (2026-10-24, 10-27). The
core guard judges a shell command by the core paths it names, so a Python or sed script that only
*mentions* the settings file, even in prose it writes elsewhere, is refused. The Edit tool's change
is judged by what it touches, and wiring a hook outside `.claude/hooks/safety/` passes without the unlock.
