# Git Bash rewrites `rev:path` arguments

**Hit 2026-10-07/08**, three times in one session reading files from main.

- **`git show origin/main:.claude/x.json` failed in Git Bash** with "ambiguous
  argument 'origin\main;.claude\x.json'": MSYS took the argument for a list of
  POSIX paths and converted it to Windows form, colon to semicolon. Prefix the
  command with `MSYS_NO_PATHCONV=1`, or read the blob from node
  (`execFileSync('git', ['show', 'origin/main:' + path])`), which no shell touches.
- **An argument that starts with `/` is rewritten too.** `git sparse-checkout
  set --no-cone '/*' '!/data/'` stored `!C:/Program Files/Git/data/`, so a
  checkout meant to leave the record out held all of it (2026-10-08, building
  the CI workflow); only `git sparse-checkout list` showed it. Same prefix,
  `MSYS_NO_PATHCONV=1`, and read the list back before trusting it.
- **Rewriting a JSON file reformats it.** `JSON.stringify(x, null, 1)` over a
  file written with two spaces turned a two-line change to
  `.claude/heartbeats.json` into 122; BAXTER's own writer reformats the same
  file again (PowerShell's spacing) on every run. Write with the file's own
  indent (read it from the first indented line), and read `git diff --stat`
  before committing: a line count far past the change is a reformat.
