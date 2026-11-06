#!/usr/bin/env node
// No view draws its own copy of a shared component.
//
// DES-001 design 3: an element that recurs is one component, and a view passes
// its content and never restates the look. Said only by instruction, copies
// kept landing: a raw <div className="card">, a hand-written .prose, a rail
// block built out of the classes instead of the parts, each one drifting from
// the component the day it was written.
//
// So this reads every view in both apps (ux/app, ux/components, dev/ui/app,
// dev/ui/components) for a raw DOM element — a lowercase tag — whose className
// carries a class a shared component owns, and names the component to use.
// Token-wise: `change-card` is not `card`, `tl-year` is not `tl-item`. A class
// passed to a component (<Count className="nav-count">) is the component's to
// place, so only lowercase tags count. The owner's own file may write its
// classes; nothing else may.
//
// A class is found however it is written on the tag: literally, through a
// name declared in the same file (const cls = 'card', followed a few names
// deep), as an object key (clsx({ card: on })), in a spread ({...{ className:
// 'card' }}, or {...props} declared with one), and with spaces around the
// `=`. A name passed in from another file, or a function's return value, is
// not followed.
//
// The check knows only the classes in OWNERS: a new shared component is held
// once its classes are added there, in the same change that makes it.
//
// Run from ux/: node scripts/check-shared-parts.mjs

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk-skip.mjs';

const UI = 'ux/components/ui/index.jsx';

// Each shared component, the file that draws it, and the classes it owns.
export const OWNERS = [
  { component: 'PageHead', files: [UI], classes: ['page-head', 'has-icon', 'page-icon', 'page-title', 'page-sub'] },
  { component: 'SectionHead', files: [UI], classes: ['section-head', 'section-anchor', 'section-note'] },
  { component: 'Crumbs', files: [UI], classes: ['crumbs', 'crumb-sep', 'crumb-current'] },
  { component: 'Count', files: [UI], classes: ['count', 'count-n'] },
  { component: 'Button', files: [UI], classes: ['btn', 'btn-quiet', 'btn-primary', 'btn-icon'] },
  { component: 'Actions', files: [UI], classes: ['actions'] },
  { component: 'Chevron', files: [UI], classes: ['chevron'] },
  { component: 'Arrow', files: ['ux/components/ui/icons.jsx'], classes: ['arrow'] },
  { component: 'Meter', files: [UI], classes: ['meter', 'meter-fill', 'meter-seg'] },
  { component: 'Card', files: [UI], classes: ['card', 'card-heading', 'card-section'] },
  { component: 'YearRule', files: [UI], classes: ['year-rule'] },
  { component: 'Empty', files: [UI], classes: ['empty', 'empty-mark'] },
  { component: 'NoMatch', files: [UI], classes: ['no-match'] },
  { component: 'Banner', files: [UI], classes: ['banner'] },
  { component: 'Note', files: [UI], classes: ['note'] },
  { component: 'Prose', files: [UI], classes: ['prose'] },
  { component: 'Enter', files: [UI], classes: ['enter'] },
  { component: 'Segmented', files: ['ux/components/ui/Segmented.jsx'], classes: ['seg', 'seg-block', 'seg-pill'] },
  { component: 'Toggle', files: ['ux/components/ui/Toggle.jsx'], classes: ['toggle', 'toggle-track', 'toggle-knob'] },
  { component: 'Row', files: ['ux/components/ui/Row.jsx'], classes: ['row', 'row-head', 'row-title', 'row-meta', 'meta-line'] },
  {
    component: 'SearchField',
    files: ['ux/components/ui/SearchField.jsx'],
    classes: ['line-filter', 'line-filter-mark', 'line-filter-field', 'line-filter-clear'],
  },
  { component: 'TimelineEntry', files: ['ux/components/ui/TimelineEntry.jsx'], classes: ['tl-item', 'tl-date', 'tl-what', 'tl-file'] },
  { component: 'Tag or FilterChip', files: [UI, 'ux/components/ui/FilterChip.jsx'], classes: ['tag'] },
  { component: 'Tags', files: [UI], classes: ['tags'] },
  { component: 'RailCard', files: ['ux/components/shell/RailFold.jsx'], classes: ['rail-card', 'rail-head', 'rail-title', 'rail-fold'] },
];

// Files that may draw the parts by hand, each for a reason of its own.
export const EXEMPT = {
  // Rendered when the root layout itself failed or the address is outside the
  // app: neither the shell nor the components can be assumed to load, so each
  // is written whole in its own file, as its comment says.
  'ux/app/not-found.jsx': 'outside the shell; written whole on purpose',
  'ux/app/global-error.jsx': 'replaces the root layout; written whole on purpose',
};

const ROOTS = ['ux/app', 'ux/components', 'dev/ui/app', 'dev/ui/components'];
const SKIP_DIRS = new Set(['node_modules', '.next']);
const SOURCE = /\.(jsx?|mjs)$/;

function owners() {
  const map = new Map();
  for (const owner of OWNERS) for (const cls of owner.classes) map.set(cls, owner);
  return map;
}

// The class strings in a className={...} expression: every quoted string and
// every template literal's fixed text, at any depth. What is left once the
// strings are taken out (names, keys, operators) is kept on `.bare`.
function stringsIn(expr) {
  const out = [];
  out.bare = '';
  let i = 0;
  function template() {
    let text = '';
    i += 1;
    while (i < expr.length && expr[i] !== '`') {
      if (expr[i] === '\\') { text += expr[i + 1] ?? ''; i += 2; continue; }
      if (expr[i] === '$' && expr[i + 1] === '{') {
        out.push(text);
        text = ' ';
        i += 2;
        code('}');
        i += 1;
        continue;
      }
      text += expr[i];
      i += 1;
    }
    i += 1;
    out.push(text);
  }
  function quoted(q) {
    let text = '';
    i += 1;
    while (i < expr.length && expr[i] !== q) {
      if (expr[i] === '\\') { text += expr[i + 1] ?? ''; i += 2; continue; }
      text += expr[i];
      i += 1;
    }
    i += 1;
    out.push(text);
  }
  function code(close) {
    let depth = 0;
    while (i < expr.length) {
      const c = expr[i];
      if (c === '`') { template(); continue; }
      if (c === '"' || c === "'") { quoted(c); continue; }
      if (c === '{') depth += 1;
      if (c === '}') {
        if (depth === 0 && close === '}') return;
        depth -= 1;
      }
      out.bare += c;
      i += 1;
    }
  }
  code(null);
  return out;
}

// The expression starting at `from`, up to the first of `stops` outside any
// bracket or string: a declaration's value, or one property's.
function exprAt(text, from, stops) {
  let depth = 0;
  let i = from;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { i = stringsEnd(text, i); continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && stops.includes(c)) break;
    i += 1;
  }
  return text.slice(from, i);
}

// What a name was declared as in the same file (const cls = 'card'), or null.
function declared(src, name) {
  const m = new RegExp(`\\b(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*=(?!=)`).exec(src);
  return m ? exprAt(src, m.index + m[0].length, ';\n') : null;
}

const NOT_NAMES = new Set(['true', 'false', 'null', 'undefined', 'typeof', 'void', 'new', 'in', 'of', 'instanceof']);

// Every class a className expression can write: its strings, the keys of an
// object in it (clsx({ card: on })), and what each bare name in it was declared
// as in the same file, followed a few names deep (const c = 'card'; className={c}).
function classTexts(expr, src, depth = 0) {
  const texts = stringsIn(expr);
  const out = [...texts];
  for (const m of texts.bare.matchAll(/(?:^|[{,])\s*([A-Za-z_$][\w$]*)\s*:/g)) out.push(m[1]);
  if (depth < 3) {
    for (const m of texts.bare.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?![\w$])(?!\s*\()/g)) {
      if (NOT_NAMES.has(m[1])) continue;
      const value = declared(src, m[1]);
      if (value != null) out.push(...classTexts(value, src, depth + 1));
    }
  }
  return out;
}

// The className a spread writes ({...{ className: 'card' }}, or {...props} where
// props was declared with one in the same file).
function spreadClass(expr, src) {
  let object = expr.trim();
  const name = /^[A-Za-z_$][\w$]*$/.test(object) ? declared(src, object) : null;
  if (name != null) object = name;
  const m = /(?:^|[{,\s])className\s*:\s*/.exec(object);
  return m ? classTexts(exprAt(object, m.index + m[0].length, ',;'), src) : [];
}

// From just past `<tag`, to the end of the opening tag: each className value
// written on it, at its own depth (not one inside a nested element in a prop).
function readTag(src, start) {
  const values = [];
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === '>') return { end: i, values };
    if (c === '"' || c === "'") {
      const close = src.indexOf(c, i + 1);
      i = close < 0 ? src.length : close + 1;
      continue;
    }
    if (c === '{') {
      const from = i;
      let depth = 0;
      for (; i < src.length; i += 1) {
        const d = src[i];
        if (d === '"' || d === "'" || d === '`') {
          // Skip a string inside the braces so a brace in it does not count.
          const sub = stringsEnd(src, i);
          i = sub - 1;
          continue;
        }
        if (d === '{') depth += 1;
        else if (d === '}' && --depth === 0) break;
      }
      i += 1;
      const inner = src.slice(from + 1, i - 1);
      if (/className\s*=\s*$/.test(src.slice(start, from))) values.push({ expr: inner });
      else if (/^\s*\.\.\./.test(inner)) values.push({ spread: inner.replace(/^\s*\.\.\./, '') });
      continue;
    }
    const attr = /^className\s*=\s*(["'])([^"']*)\1/.exec(src.slice(i, i + 400));
    if (attr && /\s/.test(src[i - 1])) {
      values.push({ text: attr[2] });
      i += attr[0].length;
      continue;
    }
    i += 1;
  }
  return { end: src.length, values };
}

// The index just past a string or template starting at i.
function stringsEnd(src, i) {
  const q = src[i];
  let j = i + 1;
  let depth = 0;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (q === '`' && c === '$' && src[j + 1] === '{') { depth += 1; j += 2; continue; }
    if (q === '`' && depth && c === '}') { depth -= 1; j += 1; continue; }
    if (!depth && c === q) return j + 1;
    j += 1;
  }
  return j;
}

// A line that is a comment, or inside a {/* */} block, is not markup.
function commentRanges(src) {
  const ranges = [];
  const block = /\{\/\*[\s\S]*?\*\/\}/g;
  let m;
  while ((m = block.exec(src))) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

export function scanSource(src, rel) {
  const own = owners();
  const findings = [];
  const comments = commentRanges(src);
  const tag = /<([a-z][a-zA-Z0-9]*)(?=[\s/>])/g;
  let m;
  while ((m = tag.exec(src))) {
    const at = m.index;
    if (comments.some(([a, b]) => at >= a && at < b)) continue;
    const lineStart = src.lastIndexOf('\n', at) + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(src.slice(lineStart, at))) continue;
    const { values } = readTag(src, at + m[0].length);
    const line = src.slice(0, at).split('\n').length;
    for (const value of values) {
      const texts = value.text != null ? [value.text] : value.spread != null ? spreadClass(value.spread, src) : classTexts(value.expr, src);
      for (const cls of new Set(texts.flatMap((t) => t.split(/\s+/)).filter(Boolean))) {
        const owner = own.get(cls);
        if (owner && !owner.files.includes(rel)) findings.push({ file: rel, line, cls, owner });
      }
    }
  }
  return findings;
}

// Every finding under `root` (the repository root, or a test's stand-in).
export function scan(root) {
  const findings = [];
  const keep = (name) => SOURCE.test(name) && !/^test-.*\.mjs$/.test(name);
  for (const top of ROOTS) {
    for (const full of walkFiles(join(root, top), { names: SKIP_DIRS, keep })) {
      const rel = relative(root, full).replace(/\\/g, '/');
      if (EXEMPT[rel]) continue;
      findings.push(...scanSource(readFileSync(full, 'utf8'), rel));
    }
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const found = scan(root);
  if (found.length) {
    console.error('SHARED PARTS CHECK FAILED (DES-001 design 3)\n');
    for (const { file, line, cls, owner } of found) {
      console.error(`  ${file}:${line} · .${cls} written by hand · use ${owner.component} (${owner.files.join(' or ')})`);
    }
    console.error('\n  Pass the content to the component; if it needs a variant, add it to the component, not beside it.');
    process.exit(1);
  }
  console.log(`shared-parts check: no view writes a shared component's class by hand (${OWNERS.length} components)`);
}
