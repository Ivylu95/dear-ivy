// Does a tool call write the record of what the developer typed? Read by
// privacy/guard-secrets.mjs, which refuses it; kept here so its rules are
// tested on their own (lib/test-typed-guard.mjs), with every command the guard
// refused by mistake kept as a case.

// The record of what the developer typed (lib/typed.mjs): only
// session/dialogue-record.mjs writes it, from his own message, so an agreed
// card's yes and a commit's `Approved:` quote are his. A call that would write
// it is refused: an editor tool aimed at it, or a shell command that changes it
// (a redirect or tee into it, an in-place edit, a copy or move onto it, a
// removal, git putting back an older copy, an editor). Reading it is not
// writing it, and passes: it holds hashes, never words, and a read-only grep
// was refused on 2026-10-30 ("Reading it is not writing it", T-474). A mention
// in prose (an Agent prompt, a message, the content of another file) writes
// nothing, and passes too: it refused an Agent prompt twice on 2026-10-27.
// The record and each later part of it, `typed-2.jsonl` and on (lib/typed.mjs, T-768).
const TYPED = /dialogue[\\/]+typed(?:-\d+)?\.jsonl/i;
const OPERATIVE = /path|command|^files?$|^from$|^root$|^cwd$/i;
export const aimedAt = (value, operative = false) => {
  if (typeof value === 'string') return operative && TYPED.test(value);
  if (Array.isArray(value)) return value.some((v) => aimedAt(v, operative));
  if (value && typeof value === 'object')
    return Object.entries(value).some(([k, v]) => {
      const op = operative || OPERATIVE.test(k);
      return (op && TYPED.test(k)) || aimedAt(v, op);
    });
  return false;
};
// Tools that only read what they are pointed at.
export const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']);
// Shell commands that only read the files they name. sed and awk are judged
// for an in-place flag, git by its verb, an interpreter by what its code calls.
const READERS = new Set(['cat', 'grep', 'egrep', 'fgrep', 'rg', 'head', 'tail', 'wc', 'less', 'more', 'sort', 'uniq', 'cut', 'tac', 'nl', 'jq', 'diff', 'cmp', 'comm', 'ls', 'stat', 'file', 'od', 'xxd', 'hexdump', 'sha256sum', 'sha1sum', 'md5sum', 'shasum', 'test', '[', 'realpath', 'readlink', 'basename', 'dirname', 'sed', 'awk', 'gawk', 'git', 'node', 'python', 'python3', 'ruby',
  // Builtins that write nothing but their output, a redirect judged apart, and the
  // words that open and close a loop (2026-11-04: `for h in …; do c=$(git log …)`).
  'echo', 'printf', 'true', 'false', ':', 'cd', 'pwd', 'exit', 'break', 'continue', 'set', 'export', 'mkdir', 'date', 'sleep', 'for', 'done', 'fi', 'esac', '}', ')']);
const COPIERS = new Set(['cp', 'rsync', 'scp']);
const GIT_READS = new Set(['log', 'show', 'diff', 'blame', 'status', 'cat-file', 'ls-files', 'ls-tree', 'grep', 'shortlog', 'annotate', 'whatchanged', 'check-attr', 'check-ignore', 'rev-list']);
// Code that writes, renames or removes, in node, python or ruby given inline.
// A call, not the word: "do not write it again" in a string given to node -e
// refused a command that wrote nothing (2026-11-03).
const CODE_WRITES = /\b(?:write|append)\w*\s*\(|\bunlink\w*\s*\(|rmSync|\brm\(|rmdir|\brename\w*\s*\(|\btruncate\w*\s*\(|copyFile|cpSync|\bcp\(|createWriteStream|shutil|os\.remove|open\([^,)]*,\s*['"][^'"]*[wax+]/i;
// A shell command is judged on the file's own name, wherever it is said from:
// `cd dev/dialogue` and then the bare name, or the folder in a variable
// (`$D/typed.jsonl`), named no path the full pattern saw, and wrote it (t5,
// 2026-11-02). Quotes and backslashes are taken out first, so a name split by
// them reads whole. Where the command speaks of the dialogue folder at all, a
// write whose target is built at run time (a variable or a substitution) is
// refused too, since what it names cannot be read here, and so is a glob that
// could match the record (`*.jsonl` after the cd); a heredoc's body is data,
// not commands, and is not read for these.
const KEYWORDS = /^(?:do|then|else|elif|if|while|until|time|exec|command|builtin|nohup|env|sudo|\{|\(|!)$/;
const NAME = /typed(?:-\d+)?\.jsonl/i;
const NEAR = /dialogue/i;
const RECORD_PATH = ['dev', 'dialogue', 'typed.jsonl'].join('/');
// A later part of the record, for a glob that could name one and not the first (`typed-*`).
const PART_PATH = ['dev', 'dialogue', 'typed-2.jsonl'].join('/');
const flat = (t) => t.replace(/['"\\]/g, '');
const REPO = (process.env.CLAUDE_PROJECT_DIR || process.cwd()).replace(/[\\/]+$/, '');
/**
 * A variable given a fixed value in the same command (`S=/tmp/x; … > $S/m.txt`)
 * is read as that value, so a path it builds is no longer unknown: fifteen of one
 * chat's refusals were scratch files under a variable set beside them
 * (2026-11-04). A value that itself expands is left as it is.
 */
export function expandFixed(cmd) {
  let out = String(cmd);
  for (const m of String(cmd).matchAll(/(?:^|[\s;&|(])([A-Za-z_]\w*)=("[^"$`]*"|'[^']*'|[^\s;&|$`'"()<>]+)(?=[\s;&|)]|$)/g)) {
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    out = out.replace(new RegExp(`\\$\\{${m[1]}\\}|\\$${m[1]}(?!\\w)`, 'g'), () => value);
  }
  return out;
}
/** Under an absolute folder outside the repository: never the record, whatever follows. */
function outside(word, root = REPO) {
  const fixed = flat(word).split(/[$`*?[]/)[0];
  if (!fixed.startsWith('/')) return false;
  const dir = fixed.replace(/[^/]*$/, '');
  return dir.length > 1 && !`${root}/`.startsWith(dir) && !dir.startsWith(`${root}/`);
}
/** A glob as a pattern for the record's path; a bracket left open reads as itself. */
function globMatches(glob) {
  for (const literal of [false, true]) {
    let re = glob.replace(/[.+^{}()|\\]/g, '\\$&');
    if (literal) re = re.replace(/[[\]]/g, '\\$&');
    re = re.replace(/\*+/g, '[^/]*').replace(/\?/g, '[^/]');
    try {
      const pattern = new RegExp(`(?:^|/)${re}$`);
      return pattern.test(RECORD_PATH) || pattern.test(PART_PATH);
    } catch {
      // An unbalanced bracket: next, as a plain character.
    }
  }
  return true;
}
/** A word naming a file only at run time: an expansion, or a glob that could match the record's path. */
function built(word) {
  const w = flat(word);
  if (outside(w)) return false;
  if (/[$`]/.test(w)) return true;
  return /[*?[]/.test(w) && globMatches(w);
}
const wordsOf = (part) => part.trim().split(/\s+/);
/** The commands in a line, split at && || ; | and newlines outside quotes, so code given to node -e stays whole. */
function segments(cmd) {
  const parts = [];
  let cur = '';
  let quote = '';
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      if (c === '\\' && quote === '"') {
        cur += c + (cmd[i + 1] ?? '');
        i++;
        continue;
      }
      if (c === quote) quote = '';
      cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ';' || c === '\n' || c === '|' || (c === '&' && cmd[i + 1] === '&')) {
      parts.push(cur);
      cur = '';
      if ((c === '|' || c === '&') && cmd[i + 1] === c) i++;
    } else cur += c;
  }
  parts.push(cur);
  return parts;
}
/** A heredoc's body is data handed to a command, not commands: taken out before a built path is looked for. */
const stripHeredocs = (cmd) => {
  const out = [];
  let end = null;
  for (const line of cmd.split('\n')) {
    if (end !== null) {
      if (line.replace(/^\t+/, '') === end) end = null;
      continue;
    }
    out.push(line);
    const m = line.match(/<<-?\s*(['"]?)([\w.-]+)\1/);
    if (m) end = m[2];
  }
  return out.join('\n');
};
/**
 * The command with every `>` and `<` inside quotes made inert, for finding redirects:
 * a grep for "^> Yes$" read as a write and refused two plain reads (2026-11-03). A
 * quoted target after a bare `>` is still a target.
 */
function redirectsOnly(cmd) {
  let out = '';
  let quote = '';
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      if (c === '\\' && quote === '"') {
        out += c + (cmd[i + 1] ?? '');
        i++;
        continue;
      }
      if (c === quote) quote = '';
      out += c === '>' || c === '<' ? '_' : c;
    } else {
      if (c === '"' || c === "'") quote = c;
      out += c;
    }
  }
  return out;
}
/** Each heredoc's body, with the command it is handed to. */
function heredocs(cmd) {
  const out = [];
  let cur = null;
  for (const line of cmd.split('\n')) {
    if (cur) {
      if (line.replace(/^\t+/, '') === cur.end) (out.push(cur), (cur = null));
      else cur.body += `${line}\n`;
      continue;
    }
    const m = line.match(/<<-?\s*(['"]?)([\w.-]+)\1/);
    if (m) {
      const before = line.slice(0, m.index).split(/[;&|]/).pop().trim().split(/\s+/);
      while (before.length && (/^\w+=/.test(before[0]) || KEYWORDS.test(before[0]))) before.shift();
      cur = { verb: (before[0] ?? '').replace(/^.*[\\/]/, ''), end: m[2], body: '' };
    }
  }
  if (cur) out.push(cur);
  return out;
}
/** A git commit with its message taken out (-m, -am, --message), so only its paths and flags are left. */
const withoutMessage = (part) =>
  part.replace(/(^|\s)(?:-[a-zA-Z]*m|--message)(?:=|\s*)("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g, '$1');
/** Does this command, read by `hit` (a target) and `inPart` (a segment), change the typed record? */
function writesBy(cmd, hit, inPart) {
  // A redirect into it, anywhere in the command, a subshell included: >, >>, >|, &>, 2>, <>.
  for (const m of redirectsOnly(cmd).matchAll(/(?:<>|[0-9&]?>>?\|?)\s*((?:"[^"]*"|'[^']*'|[^\s;&|<>()])+)/g)) if (hit(m[1])) return true;
  // A list handed on to another command, or a find that acts on what it finds.
  if (/\bxargs\b|\bfind\b[^;&|]*-(?:delete|exec|execdir|ok|fprint)/.test(cmd)) return true;
  for (const part of segments(cmd.replace(/>\|/g, '>'))) {
    if (!inPart(part)) continue;
    const words = wordsOf(part);
    while (words.length && (/^\w+=/.test(words[0]) || KEYWORDS.test(words[0]))) {
      // `c=$(git log …)` runs what is inside: that is the command.
      const inner = words[0].match(/^\w+=\$\((.+)$/);
      if (inner) words[0] = inner[1];
      else words.shift();
    }
    const [head = '', ...rest] = words;
    const verb = head.replace(/^[$(]+/, '').replace(/^.*[\\/]/, '');
    // A copy out of it reads it; a copy onto it, its last argument, writes it.
    if (COPIERS.has(verb)) {
      if (hit(rest.filter((w) => !w.startsWith('-')).pop() ?? '')) return true;
      continue;
    }
    if (!READERS.has(verb)) return true;
    if (verb === 'sed' && rest.some((w) => /^-[a-zA-Z]*i|^--in-place/.test(w))) return true;
    if ((verb === 'awk' || verb === 'gawk') && /-i\s*inplace|--inplace/.test(part)) return true;
    if (verb === 'git') {
      const sub = rest.find((w) => !w.startsWith('-') && !/^-C$/.test(w));
      // A commit is judged on its paths, never its message: a message that only
      // named the record was refused (2026-11-04). A commit naming it as a path
      // stages it, and is still refused.
      if (sub === 'commit') {
        if (inPart(withoutMessage(part))) return true;
        continue;
      }
      if (!GIT_READS.has(sub ?? '')) return true;
      if (sub === 'diff' && rest.includes('--output')) return true;
    }
    if (['node', 'python', 'python3', 'ruby'].includes(verb) && CODE_WRITES.test(part)) return true;
    if (verb === 'sort' && rest.some((w) => /^-o|^--output/.test(w))) return true;
  }
  return false;
}
// A path built at run time is ambiguous, so it is judged only where a write
// lands: a redirect, a copy's destination, a command that changes the files it
// is given, an in-place edit, git putting a file back, code that writes. A
// `$?` echoed or a variable read passes.
const WRITERS = new Set(['rm', 'mv', 'truncate', 'tee', 'ln', 'install', 'dd', 'shred', 'touch', 'unlink', 'vi', 'vim', 'nvim', 'nano', 'emacs', 'ed', 'ex', 'perl']);
const GIT_PATH_WRITES = new Set(['checkout', 'restore', 'rm', 'mv', 'reset', 'apply', 'update-index']);
function builtWrites(shell) {
  for (const m of redirectsOnly(shell).matchAll(/(?:<>|[0-9&]?>>?\|?)\s*((?:"[^"]*"|'[^']*'|[^\s;&|<>()])+)/g)) if (built(m[1])) return true;
  if (/\bxargs\b|\bfind\b[^;&|]*-(?:delete|exec|execdir|ok|fprint)/.test(shell)) return true;
  for (const part of segments(shell.replace(/>\|/g, '>'))) {
    const words = wordsOf(part);
    while (words.length && (/^\w+=/.test(words[0]) || KEYWORDS.test(words[0]))) words.shift();
    const [head = '', ...rest] = words;
    const verb = head.replace(/^.*[\\/]/, '');
    const args = rest.filter((w) => !w.startsWith('-'));
    if (!rest.some(built)) continue;
    if (COPIERS.has(verb) && built(args.pop() ?? '')) return true;
    if (WRITERS.has(verb)) return true;
    if (verb === 'sed' && rest.some((w) => /^-[a-zA-Z]*i|^--in-place/.test(w))) return true;
    if ((verb === 'awk' || verb === 'gawk') && /-i\s*inplace|--inplace/.test(part)) return true;
    if (verb === 'git' && GIT_PATH_WRITES.has(args[0] ?? '')) return true;
    if (['node', 'python', 'python3', 'ruby'].includes(verb) && CODE_WRITES.test(part)) return true;
  }
  return false;
}
/** Does this shell command change the typed record? Read by its name, and by a path built where its folder is spoken of. */
export function shellWrites(command) {
  const raw = expandFixed(command);
  const named = (t) => NAME.test(flat(t));
  // A heredoc's body is the data or code handed to its command, never commands of
  // this shell: a script written to a file, or Python given its edit, named the
  // record and was refused (2026-11-03). Code handed to an interpreter is judged
  // line by line, a line naming the record and writing; a shell given one runs it.
  for (const { verb, body } of heredocs(raw)) {
    if (['sh', 'bash', 'zsh'].includes(verb) && shellWrites(body)) return true;
    if (['node', 'python', 'python3', 'ruby', 'perl'].includes(verb) && body.split('\n').some((l) => named(l) && CODE_WRITES.test(l))) return true;
  }
  const cmd = stripHeredocs(raw);
  if (named(cmd) && writesBy(cmd, named, named)) return true;
  if (!NEAR.test(flat(cmd))) return false;
  // Nothing in single quotes expands, so it cannot build a path: a sed pattern ending
  // in `$` read as one and refused an edit of the Transcript (2026-11-05).
  const shell = stripHeredocs(cmd).replace(/'[^']*'/g, "'q'");
  return wordsOf(shell).some(built) && builtWrites(shell);
}
