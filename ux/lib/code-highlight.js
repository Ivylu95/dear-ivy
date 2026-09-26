// Syntax colouring for the harness source views.
//
// ── Why this does not break the rule above it ───────────────────────────────
//
// lib/harness.js and page.jsx both say these files are shown "exactly as they
// are on disk", and that rule is the reason this view can be trusted: a hook is
// read to check an exact value — a matcher, a path, a permission — and a
// rendering that reflows or prettifies it is a rendering you have to verify
// somewhere else before you can act on it.
//
// Colour does not touch that. Nothing here inserts, removes, reorders or
// normalises a character; it decides, for each character already there, what
// KIND of thing it is part of. The output is the same string in the same order,
// cut into runs. That is the invariant to keep if this file is ever extended,
// and it is testable in one line: the runs concatenated are the input.
//
// ── Why not a library ───────────────────────────────────────────────────────
//
// The harness holds two languages — JavaScript and JSON — in fifteen files, the
// largest of them 10kb. highlight.js is ~900kb of grammars to answer that, shiki
// ships a WASM regex engine, and both would be a dependency this app does not
// otherwise have, carried for one view. A tokeniser that knows two languages is
// small enough to read in full, which is the better trade at this size.
//
// It is a tokeniser, not a parser. It will not know that a name is a type or
// that a call is a method, and it is not trying to — the distinctions it does
// draw (comment, string, number, keyword, literal, regex, JSON key) are the ones
// that make a file scannable.

// Not read anywhere, and deliberately kept: it names the 0 slot so the table
// below lines up with the constants rather than starting at 1 with a gap.
// eslint-disable-next-line no-unused-vars
const PLAIN = 0;
const COMMENT = 1;
const STRING = 2;
const NUMBER = 3;
const KEYWORD = 4;
const REGEX = 6;
const KEY = 7;
const LITERAL = 8;

// Indexed by the constants above. PLAIN is empty so a plain run is emitted as
// bare text with no wrapper at all — see runs() for why that matters.
//
// Slot 5 is a hole where punctuation used to be, and it is worth saying why
// rather than closing it up as though it had never been there. Dimming brackets
// and commas is the classic last touch of an editor theme, and it cost 517 spans
// on the largest hook — 38% of the page, for a distinction you have to look for
// to see. Punctuation is plain now; the shape of the code reads from its
// indentation and its colour without it.
const KIND = ['', 'comment', 'string', 'number', 'keyword', '', 'regex', 'key', 'literal'];

const KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
  'for', 'from', 'function', 'get', 'if', 'import', 'in', 'instanceof', 'let',
  'new', 'of', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw',
  'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

// Values rather than syntax, so they take a colour of their own. `undefined` and
// the globals are here because in a hook they are read as values too.
const LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'process', 'console',
]);

// After any of these, a `/` opens a regular expression. After anything else — a
// name, a number, a closing bracket — it is division.
//
// This is the one genuinely ambiguous character in JavaScript and the place a
// naive highlighter goes wrong: `a / b / c` becomes a string-coloured smear from
// the first slash to the second. The rule below is the standard one, and the
// hooks lean on it hard — crisis-floor.mjs is a list of thirty regexes.
const BEFORE_REGEX = new Set([
  '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*',
  '%', '~', '^', '<', '>', '\n',
]);

const BEFORE_REGEX_WORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do',
  'else', 'yield', 'await', 'case',
]);

const isWordStart = (c) => c === '_' || c === '$' || /[A-Za-z]/.test(c);
const isWord = (c) => c === '_' || c === '$' || /[A-Za-z0-9]/.test(c);
const isDigit = (c) => c >= '0' && c <= '9';
const isPunct = (c) => '{}()[].,;:?!<>=+-*/%&|^~'.includes(c);

/**
 * A string literal, from its opening quote to its closing one.
 *
 * Backslash escapes are honoured so `'it\'s'` is one string rather than two, and
 * an unterminated quote runs to the end of the line for `'` and `"` but to the
 * end of the file for a backtick — which is what each of them actually does.
 */
function endOfString(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    if (c === '\n' && quote !== '`') return i;
    i += 1;
  }
  return src.length;
}

/**
 * A regular expression literal, or null if this slash does not open one.
 *
 * A character class is tracked, because `/[/]/` is a valid regex whose middle
 * slash does not close it. A newline before the closing slash means this was
 * division after all.
 */
function endOfRegex(src, start) {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '\n') return null;
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      i += 1;
      while (i < src.length && /[a-z]/.test(src[i])) i += 1;
      return i;
    }
    i += 1;
  }
  return null;
}

function endOfNumber(src, start) {
  const rest = src.slice(start, start + 64);
  const match = /^(?:0[xXbBoO][0-9a-fA-F_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)n?/.exec(rest);
  return match ? start + match[0].length : start + 1;
}

function paintJs(src, kinds) {
  let i = 0;
  // The last thing that was not whitespace: a single character, or a word. Only
  // used to answer the slash question above.
  let prev = '';

  const fill = (from, to, kind) => {
    for (let x = from; x < to; x += 1) kinds[x] = kind;
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      fill(i, end < 0 ? src.length : end, COMMENT);
      i = end < 0 ? src.length : end;
      continue;
    }

    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      const end = close < 0 ? src.length : close + 2;
      fill(i, end, COMMENT);
      i = end;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const end = endOfString(src, i);
      fill(i, end, STRING);
      i = end;
      prev = 'x';
      continue;
    }

    if (c === '/' && (BEFORE_REGEX.has(prev) || BEFORE_REGEX_WORDS.has(prev))) {
      const end = endOfRegex(src, i);
      if (end) {
        fill(i, end, REGEX);
        i = end;
        prev = 'x';
        continue;
      }
    }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      const end = endOfNumber(src, i);
      fill(i, end, NUMBER);
      i = end;
      prev = 'x';
      continue;
    }

    if (isWordStart(c)) {
      let end = i + 1;
      while (end < src.length && isWord(src[end])) end += 1;
      const word = src.slice(i, end);
      if (KEYWORDS.has(word)) fill(i, end, KEYWORD);
      else if (LITERALS.has(word)) fill(i, end, LITERAL);
      i = end;
      prev = word;
      continue;
    }

    // Left plain, but still remembered: `prev` is how the slash below knows
    // whether it opens a regex or divides, and that answer depends on the
    // punctuation before it whether or not the punctuation is coloured.
    if (isPunct(c)) {
      prev = c;
      i += 1;
      continue;
    }

    // Whitespace and anything else: left plain, and left OUT of `prev`, so a
    // slash at the start of an indented line still sees the line before it.
    if (c === '\n') prev = '\n';
    i += 1;
  }
}

function paintJson(src, kinds) {
  let i = 0;

  const fill = (from, to, kind) => {
    for (let x = from; x < to; x += 1) kinds[x] = kind;
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '"') {
      const end = endOfString(src, i);
      // A key is a string with a colon after it. Looking ahead rather than
      // tracking depth, because that is the whole of the difference in JSON and
      // it cannot be got wrong by a brace this function miscounted.
      let after = end;
      while (after < src.length && /\s/.test(src[after])) after += 1;
      fill(i, end, src[after] === ':' ? KEY : STRING);
      i = end;
      continue;
    }

    if (isDigit(c) || (c === '-' && isDigit(src[i + 1]))) {
      const end = endOfNumber(src, c === '-' ? i + 1 : i);
      fill(i, end, NUMBER);
      i = end;
      continue;
    }

    if (isWordStart(c)) {
      let end = i + 1;
      while (end < src.length && isWord(src[end])) end += 1;
      fill(i, end, LITERAL);
      i = end;
      continue;
    }

    i += 1;
  }
}

/**
 * One kind per character of `source`.
 *
 * A byte array rather than a token list, because the consumer needs to cut the
 * result at line boundaries and a flat map makes that a slice instead of a
 * second pass that has to split tokens spanning a newline — which every block
 * comment in these files does.
 */
export function paint(source, lang) {
  const src = String(source ?? '');
  const kinds = new Uint8Array(src.length);
  if (lang === 'json') paintJson(src, kinds);
  else if (lang === 'javascript' || lang === 'typescript') paintJs(src, kinds);
  return kinds;
}

/**
 * One line, as the runs it is made of.
 *
 * A plain run comes back with no `k`, and the caller renders it as bare text
 * rather than as a wrapped span. That is not tidiness: these files are mostly
 * prose in comments and indentation, so leaving the uncoloured majority
 * unwrapped is most of the difference between a page that carries a span per
 * word and one that carries a handful per line.
 *
 * @returns {{t: string, k?: string}[]}
 */
export function runs(source, kinds, from, to) {
  const out = [];
  let start = from;

  for (let i = from; i <= to; i += 1) {
    const kind = i < to ? kinds[i] : -1;
    if (i === to || kind !== kinds[start]) {
      const text = source.slice(start, i);
      if (text) {
        const name = KIND[kinds[start]];
        out.push(name ? { t: text, k: name } : { t: text });
      }
      start = i;
    }
  }

  return out;
}
