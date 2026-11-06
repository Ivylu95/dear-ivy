// The About page's read-only claim never stands alone (ABT-003): beside it, the
// one narrow write the surface has, and a route to how the writing happens.
// Read from the page's source, since the page is a server component.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(join(import.meta.dirname, '..', 'app', '(dashboard)', 'about', 'page.jsx'), 'utf8');
const instructions = readFileSync(join(import.meta.dirname, '..', '..', 'CLAUDE.md'), 'utf8');

describe('the About page (ABT-003)', () => {
  test('the read-only claim is followed by the one write the surface has', () => {
    assert.match(source, /it never writes to them/);
    assert.match(source, /your own picture/);
  });
  test('it links to the workflow view, where that view is present', () => {
    assert.match(source, /ADMIN_PRESENT\s*&&/);
    assert.match(source, /\$\{ADMIN_BASE\}\/workflow/);
  });
});

// ABT-001: the three promises are stated on the page, to her, and still say what
// the instruction file they mirror says. Each pair is the page's wording and the
// instruction file's wording of the same promise; changing either alone fails.
describe('the About page states the three promises (ABT-001)', () => {
  const promises = [
    ['never files', /You never file anything/, /never files, never names a file/i],
    ['nothing deleted', /Nothing is ever deleted/, /Nothing is ever deleted/i],
    ['not a clinician', /It is not a therapist/, /not\*\* their therapist and you do not diagnose/i],
  ];
  for (const [name, onPage, inInstructions] of promises) {
    test(`${name}: on the page, and in the instruction file it mirrors`, () => {
      assert.match(source, onPage);
      assert.match(instructions, inInstructions);
    });
  }
  test('the promises are under one heading, in the second person', () => {
    const section = source.split('id="three-things-it-promises"')[1]?.split('<h2')[0] ?? '';
    assert.match(section, /<strong>/);
    assert.match(section, /\byou\b/i);
    assert.match(section, /\byour\b/i);
    assert.equal((section.match(/<strong>/g) ?? []).length, 3);
  });
});
