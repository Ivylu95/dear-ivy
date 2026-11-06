// The markdown helpers every view of the record reads through (lib/markdown.js):
// anchors that match the rail, an empty template that reads as empty, and the
// tables the timeline and calendar are parsed from. Pure.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasContent, headingIds, sections, stripComments, table, toHtml } from '@/lib/markdown';

describe('headings carry anchors, a repeated one numbered', () => {
  test('each heading gets its slug, a repeat gets -1', () => {
    const html = headingIds(toHtml('## What helps\n\nx\n\n## What helps\n\ny'));
    assert.match(html, /<h2 id="what-helps">/);
    assert.match(html, /<h2 id="what-helps-1">/);
  });
});

describe('an unwritten template reads as empty', () => {
  test('guidance in italics, a heading, a quote and a comment are not content', () => {
    assert.equal(hasContent('## Eras\n\n_Three or four lines per quarter: the shape of the\nperiod, not its contents._\n\n> a note\n\n<!-- hidden -->'), false);
  });
  test('one real sentence is', () => {
    assert.equal(hasContent('_Guidance._\n\nSlept badly, then better.'), true);
  });
  test('comments are stripped', () => {
    assert.equal(stripComments('a <!-- b --> c').replace(/\s+/g, ' ').trim(), 'a c');
  });
});

describe('sections and tables', () => {
  const doc = [
    '# Title',
    'Lead line.',
    '## Tags in use',
    '`sleep` · `work`',
    '## Entries',
    '| Date | Type | What happened |',
    '| --- | --- | --- |',
    '| 2026-01-02 | event | First |',
    '|  |  |  |',
    '| 2026-02-03 | note | Second |',
  ].join('\n');

  test('the lead is what sits above the first ## heading', () => {
    const s = sections(doc);
    assert.match(s.lead, /Lead line/);
    assert.deepEqual(s.sections.map((x) => x.heading), ['Tags in use', 'Entries']);
  });
  test('a table under its heading, keyed by header cells, with the template\'s empty row dropped', () => {
    const rows = table(doc, 'Entries');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].date, '2026-01-02');
    assert.equal(rows[1].what_happened, 'Second');
  });
  test('a heading that is not there gives no rows', () => {
    assert.deepEqual(table(doc, 'Nowhere'), []);
  });
});

describe('markup written into a file is shown, never run (DPV-004 design 3)', () => {
  test('a script, a refresh and a styled block reach the page as text', () => {
    const html = toHtml('<script>alert(1)</script>\n\n<meta http-equiv="refresh" content="0;url=https://example.com">\n\n<div style="position:fixed">x</div>');
    assert.doesNotMatch(html, /<script|<meta|<div/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&lt;meta http-equiv=&quot;refresh&quot;/);
  });
  test('inline markup inside a sentence is escaped in place', () => {
    assert.match(toHtml('a <img src=x onerror=y> b'), /<p>a &lt;img src=x onerror=y&gt; b<\/p>/);
  });
  test('comments are dropped, block or inline', () => {
    const html = toHtml('<!-- a note -->\n\nkept <!-- inline --> here');
    assert.doesNotMatch(html, /note|inline|&lt;!--/);
    assert.match(html, /kept\s+here/);
  });
  test('markup in backticks and markdown itself are unchanged', () => {
    assert.match(toHtml('use `<br>` and **bold**'), /<code>&lt;br&gt;<\/code> and <strong>bold<\/strong>/);
    assert.match(toHtml('[[KEY]](https://example.com "limit")'), /<a class="src-tag" href="https:\/\/example.com" title="limit"/);
  });
});

describe('an estimate reads as an estimate (marked 17 and later)', () => {
  test('two single tildes in a line are "about", never struck through', () => {
    const html = toHtml('breakfast (~270 kcal), an apple (~95 kcal)');
    assert.doesNotMatch(html, /<del>/);
    assert.match(html, /~270 kcal\), an apple \(~95 kcal\)/);
  });
  test('a double tilde still strikes through', () => {
    assert.match(toHtml('~~gone~~'), /<del>gone<\/del>/);
  });
  test('an ampersand in a link address is escaped, as HTML wants it', () => {
    assert.match(toHtml('<https://example.com/?a=1&b=2>'), /href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
  });
});
