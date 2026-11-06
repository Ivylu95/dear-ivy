// What a git command line says once git's own global options are set aside:
// read by the history guards before they match a subcommand.
//
// SFG-011, "No committed version is ever lost, here or on the remote.", and
// DAT-005's record-history rule. The guards matched `git\s+push`, `git\s+commit`
// and the like, so any option git takes before its subcommand slipped past
// them: `git -c k=v push --force`, `git -C . commit --amend`, and
// `git --no-pager show HEAD:data/...` were all let through (design audit,
// 2026-10-08). Stripping the options first means every rule reads the
// subcommand where it expects it, however the command was spelt.
//
// Part of the safety core (guard-safety-core.mjs lists it): a change here
// changes what the core guards refuse.

// Global options that take a value, as a separate word or after `=`.
const WITH_VALUE = '-C|-c|--git-dir|--work-tree|--namespace|--super-prefix|--config-env';
// Global options that stand alone, and those whose value only ever follows `=`.
const BARE =
  '-p|-P|--paginate|--no-pager|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|' +
  '--noglob-pathspecs|--icase-pathspecs|--no-optional-locks|--no-lazy-fetch|--no-advice|' +
  '--exec-path(?:=\\S+)?|--list-cmds=\\S+';
const VALUE = `(?:"[^"]*"|'[^']*'|\\S+)`;
const OPTION = `(?:(?:${WITH_VALUE})(?:=${VALUE}|\\s+${VALUE})|(?:${BARE})(?=\\s|$))`;
const GLOBALS = new RegExp(`(\\bgit)((?:\\s+${OPTION})+)`, 'g');
const DIR = new RegExp(`(?:^|\\s)(?:-C|--git-dir|--work-tree)(?:=|\\s+)(${VALUE})`, 'g');

/** The command with every git invocation's global options removed: `git -C . push -f` reads `git push -f`. */
export function withoutGitGlobals(command) {
  return String(command ?? '').replace(GLOBALS, '$1');
}

/**
 * The folders a git invocation's global options point it at (`-C`, `--git-dir`,
 * `--work-tree`), unquoted, in order. Empty when it runs where it stands.
 */
export function gitTargets(command) {
  const out = [];
  for (const m of String(command ?? '').matchAll(GLOBALS)) {
    for (const [, v] of m[2].matchAll(DIR)) out.push(v.replace(/^["']|["']$/g, ''));
  }
  return out;
}
