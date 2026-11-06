# A path in prose is read from the repository root

`check-links.mjs` (in the commit gate) resolves every backticked path in the
specs, the memory notes and the READMEs from the repository root, not from the
file it sits in. So the short form (session/test-session-meta.mjs) in `dev/specs/system/dev.md`
fails the gate, and `.claude/hooks/session/test-session-meta.mjs` passes. Examples of a
bad path, like the one just given, go unbackticked, or they fail it too.

Hit twice in one chat (2026-09-30, a memory note; 2026-10-01, a spec row),
both times naming a hook file by its short, hooks-folder path, the way the
hooks README does. The README gets away with it because its table names are
not backticked paths the check follows; a spec or a note does not.

Write the full path from the root in any spec, note or README line that names
a file. The gate still catches a slip, but each one costs a refused commit.
