#!/usr/bin/env node
// The shared-parts check (check-shared-parts.mjs, DES-001 design 3), against
// views written into a throwaway folder shaped like the repository: it catches
// a raw element writing an owned class, written literally or through a name, an
// object key, a spread or a spaced `className =`, and leaves alone a component
// placed by its className, a class that only contains an owned one, a name
// that holds no owned class, and the owner's own file.
//
// Run from ux/: node scripts/test-check-shared-parts.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { scan } from './check-shared-parts.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const root = makeTemp('dear-shared-parts-');
const put = (rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const ROW = 'className={`row${past ? \' is-past\' : \'\'}`}';
const cases = [
  ['a raw <div className="card"> is caught', 'ux/app/a/page.jsx', '<div className="card">x</div>', ['card']],
  ['<Card className="x"> is a component placed, not a copy', 'ux/app/b/page.jsx', '<Card className="x">y</Card>', []],
  ['className="change-card" is not .card', 'dev/ui/components/c.jsx', '<div className="change-card">z</div>', []],
  ['a template literal writing .row is caught outside Row.jsx', 'dev/ui/app/d/page.jsx', `<div ${ROW}>w</div>`, ['row']],
  ['the same template inside Row.jsx is the owner drawing it', 'ux/components/ui/Row.jsx', `<div ${ROW}>w</div>`, []],
  ['a class in a comment is not markup', 'ux/app/e/page.jsx', '{/* <div className="card"> */}\n<p>ok</p>', []],
  ['a class held in a name is caught', 'ux/app/f/page.jsx', '<div className={cls}>v</div>', ['card'], "const cls = 'card';"],
  ['a name two steps from the class is caught', 'ux/app/g/page.jsx', '<div className={outer}>v</div>', ['btn', 'btn-quiet'], "const inner = 'btn btn-quiet';\n  const outer = past ? inner : 'x';"],
  ['a name holding no owned class is left alone', 'ux/app/h/page.jsx', '<div className={cls}>v</div>', [], "const cls = 'change-card';"],
  ['an object key in clsx is caught', 'ux/app/i/page.jsx', '<div className={clsx({ card: past, other: true })}>v</div>', ['card']],
  ['a literal spread carrying className is caught', 'ux/app/j/page.jsx', "<div {...{ className: 'prose', id: 'x' }}>v</div>", ['prose']],
  ['a spread of a name declared with className is caught', 'ux/app/k/page.jsx', '<div {...props}>v</div>', ['banner'], "const props = { className: past ? 'banner' : 'banner', role: 'note' };"],
  ['a spread with no className is left alone', 'ux/app/l/page.jsx', '<a {...rest}>v</a>', [], "const rest = { href: '/card' };"],
  ['className ="x" with a space is caught', 'ux/app/m/page.jsx', '<div className ="card">v</div>', ['card']],
  ['className = {...} with spaces is caught', 'ux/app/n/page.jsx', "<div className = {'note'}>v</div>", ['note']],
  ['a function call is not a name to follow', 'ux/app/o/page.jsx', '<div className={make()}>v</div>', [], "const make = () => 'row';"],
];

let failed = 0;
try {
  for (const [, rel, body, , pre = ''] of cases) put(rel, `export default function V({ past }) {\n  ${pre}\n  return (\n    ${body}\n  );\n}\n`);
  const found = scan(root);
  for (const [what, rel, , expected] of cases) {
    const got = found.filter((f) => f.file === rel).map((f) => f.cls);
    const ok = got.length === expected.length && expected.every((c) => got.includes(c));
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` (found: ${got.join(', ') || 'nothing'})`}`);
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`\nshared-parts test: ${failed} of ${cases.length} failed`);
  process.exit(1);
}
console.log(`\nshared-parts test: all ${cases.length} passed`);
