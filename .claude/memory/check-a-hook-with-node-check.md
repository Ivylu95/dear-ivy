# Check a hook's syntax with `node --check`, never by importing it

**Seen 2026-11-04.** To check an edit to `.claude/hooks/git/pre-commit` would parse, a chat ran
`node -e "import('.claude/hooks/git/pre-commit')"`. A hook is a script, not a module: importing it
ran it, and the commit gate started on the working tree, ran past the command's time limit and had
to be stopped by hand.

- **Syntax only:** `node --check <file>`. It parses and runs nothing.
- **To try a hook for real**, run its test (`test-<name>.mjs` beside it) or the selftest, which feed
  it a payload in a scratch copy, never the live checkout.
