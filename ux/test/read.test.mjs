// The record's read layer (lib/content-read.js), against the invented record in
// data-sample/ and never hers (SMP-001). Outside a request the read layer falls
// back to the real record, so every read here runs inside inRecord(sample), and
// the suite refuses to start unless the sample is the folder it would read.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { activeDir, inRecord, RECORDS } from '@/lib/data-dir';
import { getCalendar, getHome, getNavCounts, getOpenLoops, getPeople, getTimeline } from '@/lib/content-read';
import { daysAway } from '@/lib/dates';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const uxRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sample = RECORDS.sample;
const read = (fn) => inRecord(sample, fn);

before(() => {
  assert.ok(existsSync(join(sample.dir, 'IS_SAMPLE')), 'data-sample/ is here and marked as the sample');
  assert.equal(read(() => activeDir()), sample.dir, 'every read below is of the sample, never her record');
});

describe('the loader never reaches her record', () => {
  test('outside any scope, the record read is the sample (register.mjs)', () => {
    assert.equal(RECORDS.real.dir, sample.dir);
    assert.equal(activeDir(), sample.dir);
  });
});

describe('the timeline', () => {
  test('entries come newest first, each with a real date or none', () => {
    const { entries, filled } = read(() => getTimeline());
    assert.ok(filled && entries.length > 3);
    for (let i = 1; i < entries.length; i += 1) assert.ok(String(entries[i - 1].date) >= String(entries[i].date), 'newest first');
    for (const e of entries) assert.ok(e.date === null || /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  });
  test('the filter offers the record\'s own declared tags', () => {
    const { tags } = read(() => getTimeline());
    for (const t of ['sleep', 'work', 'family']) assert.ok(tags.includes(t), `declared tag ${t}`);
  });
});

describe('the calendar', () => {
  const now = new Date(Date.UTC(2026, 5, 1, 12)); // 1 June 2026
  test('what is coming and what has gone split on today', () => {
    const { upcoming, passed } = read(() => getCalendar(now));
    for (const r of upcoming) assert.ok(daysAway(r.date, now) === null || daysAway(r.date, now) >= 0, `${r.date} is not past`);
    for (const r of passed) assert.ok(daysAway(r.date, now) < 0, `${r.date} is past`);
  });
  test('a hard anniversary is near only inside a fortnight', () => {
    const { hard, nearHard } = read(() => getCalendar(now));
    for (const h of hard) assert.equal(h.near, h.daysAway != null && h.daysAway <= 14);
    assert.deepEqual(nearHard, hard.filter((h) => h.near));
  });
});

describe('every getter answers', () => {
  // The read layer was one file until 2026-10-08 and is now ten (lib/read/):
  // each getter run once on the sample proves its imports came with it.
  test('each view\'s reader runs on the sample without throwing', async () => {
    const all = await import('@/lib/content-read');
    const names = Object.keys(all).filter((k) => typeof all[k] === 'function');
    assert.equal(names.length, 18, "the eighteen getters the views read");
    const first = read(() => all.getPeople());
    const slug = (Array.isArray(first) ? first : (first.people ?? []))[0]?.slug ?? 'nobody';
    for (const name of names) {
      const arg = name === 'getPerson' ? slug : name === 'getMentions' ? 'Person-W' : undefined;
      assert.doesNotThrow(() => read(() => all[name](arg)), name);
    }
  });
});

describe('the people', () => {
  test('everyone on file is read, each with a name', () => {
    const people = read(() => getPeople());
    const list = Array.isArray(people) ? people : (people.people ?? []);
    assert.ok(list.length > 0);
  });
});

// LPS-005: a group written as prose shows prose, and is not reported as empty.
describe('open loops written as prose (LPS-005)', () => {
  test('a file whose groups are all prose is shown, not reported as having nothing', () => {
    const dir = makeTemp('loops-');
    try {
      mkdirSync(join(dir, 'core', 'state'), { recursive: true });
      writeFileSync(join(dir, 'core', 'state', 'open_loops.md'), '# Open loops\n\n## Raise next session\n\nSomething still sitting here, written as a paragraph.\n');
      const loops = inRecord({ dir }, () => getOpenLoops());
      assert.equal(loops.groups.length, 1);
      assert.equal(loops.groups[0].items.length, 0);
      assert.match(loops.groups[0].html, /still sitting here/);
      assert.equal(loops.shown, true, 'prose alone counts as something to show');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test('the sample, with items, is shown too', () => {
    assert.equal(read(() => getOpenLoops()).shown, true);
  });
});

// NOW-001: the home view renders the session's read in its order, now.md first
// and then the timeline, before what those two point at.
describe('the home view keeps the session\'s order (NOW-001)', () => {
  test('now.md, then the timeline, then calendar and loops', () => {
    const src = readFileSync(join(uxRoot, 'app', '(dashboard)', 'page.jsx'), 'utf8');
    const at = (needle) => {
      const i = src.indexOf(needle);
      assert.ok(i >= 0, `home page has ${needle}`);
      return i;
    };
    const order = [at('data/core/state/now.md'), at('title="Lately"'), at('title="Coming up"'), at('title="For the next appointment"')];
    for (let i = 1; i < order.length; i += 1) assert.ok(order[i - 1] < order[i], 'sections are out of the session\'s reading order');
  });
});

// CON-001: nothing rewards returning. The rail counts only things on file, and
// the read layer the specs name says why where the counts are made.
describe('nothing counts her returning (CON-001)', () => {
  test('the rail counts people and open threads only, never her sessions or entries', () => {
    const keys = Object.keys(read(() => getNavCounts()));
    assert.deepEqual(keys.filter((k) => !['/people', '/loops'].includes(k)), [], 'a rail count was added beyond people and open threads');
  });
  test('the read layer cites the row beside the counts', () => {
    const src = readFileSync(join(uxRoot, 'lib', 'content-read.js'), 'utf8');
    assert.match(src, /CON-001/, 'content-read.js does not cite CON-001');
  });
});

// NOW-002: no view states a quantity, frequency or interval describing her.
// Figures are for things on file (open threads), never her entries or sessions.
describe('no rendered figure counts her (NOW-002)', () => {
  const ALLOWED = ['outstanding.length'];
  const pages = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pages(join(d, e.name)) : /\.jsx$/.test(e.name) ? [join(d, e.name)] : []));
  // The figures a page text interpolates: a length or a size, outside comments.
  const figures = (source) => {
    const code = source.split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l)).join('\n');
    const found = [];
    for (const m of code.matchAll(/\$\{([^}]*\.(?:length|size)\b[^}]*)\}|\{([^{}]*\.(?:length|size)\b[^{}]*)\}/g)) {
      const expr = (m[1] ?? m[2]).trim();
      if (m[2] && /[:,]/.test(expr)) continue; // an object literal, not text she reads
      if (/[?&|]|[<>=]/.test(expr)) continue; // a condition, not a figure
      if (!ALLOWED.some((a) => expr.includes(a))) found.push(expr);
    }
    return found;
  };
  test('no page interpolates a length into what she reads', () => {
    const found = [];
    for (const file of pages(join(uxRoot, 'app', '(dashboard)'))) {
      for (const expr of figures(readFileSync(file, 'utf8'))) found.push(`${file.slice(uxRoot.length + 1)}: ${expr}`);
    }
    assert.deepEqual(found, [], 'a figure was rendered that counts what she has written');
  });
  test('the sweep itself catches a planted count of entries, by length or by size', () => {
    assert.deepEqual(figures('<p>{entries.length} written</p>'), ['entries.length']);
    assert.deepEqual(figures('<p>{`${days.size} days`}</p>'), ['days.size']);
    assert.deepEqual(figures('<p>{outstanding.length} open</p>'), [], 'a thing on file is allowed');
  });
  // The pages are not the only place a figure can be drawn: every component a
  // page borrows is swept the same way, so a count hidden in one is caught too.
  test('no shared component interpolates a length into what she reads', () => {
    const found = [];
    for (const file of pages(join(uxRoot, 'components'))) {
      for (const expr of figures(readFileSync(file, 'utf8'))) found.push(`${file.slice(uxRoot.length + 1)}: ${expr}`);
    }
    assert.deepEqual(found, [], 'a component renders a figure that counts what she has written');
  });
  // A frequency or an interval is a figure with no length in it: "a streak",
  // "3 days since". The words are swept from every page and component, outside
  // comments.
  const RATE_WORDS = /\b(streaks?|days? since|days? ago|per (?:day|week|month)|in a row)\b/i;
  const rateWords = (source) =>
    source
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l))
      .filter((l) => RATE_WORDS.test(l) && !/\bno streaks?\b/i.test(l)) // the About page promises there are none
      .map((l) => l.trim());
  test('no page or component words a frequency or an interval', () => {
    const found = [];
    for (const root of [join(uxRoot, 'app'), join(uxRoot, 'components')]) {
      for (const file of pages(root)) for (const l of rateWords(readFileSync(file, 'utf8'))) found.push(`${file.slice(uxRoot.length + 1)}: ${l}`);
    }
    assert.deepEqual(found, [], 'a view words how often or how long since she wrote');
  });
  test('the rate sweep itself catches a planted streak and a planted interval', () => {
    assert.equal(rateWords('<p>a 4 day streak</p>').length, 1);
    assert.equal(rateWords('<p>last written 3 days ago</p>').length, 1);
    assert.equal(rateWords('// no streak anywhere here').length, 0, 'a comment is not rendered');
    assert.equal(rateWords('There are no streaks here.').length, 0, 'a promise of none is not a figure');
  });
  // The rail's `meta` is text she reads beside a link, and the sweep above skips
  // an object literal, so a count written there got through: entries per year on
  // the timeline, appointments held in the therapy rail. Only things on file
  // (open threads, dates ahead, mentions of a person) may be counted there.
  const META_ALLOWED = ['open', 'count', 'mentions.length'];
  const metaFigures = (source) =>
    source
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l))
      .flatMap((l) => [...l.matchAll(/\bmeta:\s*String\(([^)]*)\)/g)].map((m) => m[1].trim()))
      .filter((expr) => !META_ALLOWED.includes(expr));
  test('no rail counts her entries or sessions beside a link', () => {
    const found = [];
    for (const file of pages(join(uxRoot, 'app', '(dashboard)'))) {
      for (const expr of metaFigures(readFileSync(file, 'utf8'))) found.push(`${file.slice(uxRoot.length + 1)}: ${expr}`);
    }
    assert.deepEqual(found, [], 'a rail shows a figure that counts what she has written or attended');
  });
  // `meta` can also be written as a template (`${n} entries`) or as a bare
  // length, neither of which the String(...) form above sees.
  const metaTemplates = (source) =>
    source
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l))
      .flatMap((l) => [...l.matchAll(/\bmeta:\s*(`[^`]*\$\{[^`]*`|[\w.]+\.(?:length|size)\b)/g)].map((m) => m[1].trim()))
      .filter((expr) => !META_ALLOWED.some((a) => expr.includes(a)));
  test('no rail words a count of her entries or sessions as a template', () => {
    const found = [];
    for (const file of pages(join(uxRoot, 'app', '(dashboard)'))) {
      for (const expr of metaTemplates(readFileSync(file, 'utf8'))) found.push(`${file.slice(uxRoot.length + 1)}: ${expr}`);
    }
    assert.deepEqual(found, [], 'a rail words a figure that counts what she has written or attended');
  });
  test('the template sweep catches a planted count and lets a thing on file through', () => {
    assert.deepEqual(metaTemplates('{ label: y, meta: `${entries.length} entries` }'), ['`${entries.length} entries`']);
    assert.deepEqual(metaTemplates('{ label: y, meta: sessions.length }'), ['sessions.length']);
    assert.deepEqual(metaTemplates('{ label: y, meta: `${mentions.length} mentions` }'), [], 'a thing on file is allowed');
    assert.deepEqual(metaTemplates('{ label, meta: note }'), [], 'plain text is not a figure');
  });
  // A <Count> or a badge is a figure drawn by the shared parts. Pages and rails
  // hand one only a thing on file; the shell draws the navigation's own.
  const badgeFigures = (source) =>
    source
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l))
      .flatMap((l) => [...l.matchAll(/<Count\b[^>]*>\s*\{([^}]*)\}|\bbadge=\{([^}]*)\}/g)].map((m) => (m[1] ?? m[2]).trim()))
      .filter((expr) => !['outstanding.length', 'open', 'mentions.length'].includes(expr));
  test('no page hands a badge or a count a figure of her entries or sessions', () => {
    const found = [];
    for (const file of pages(join(uxRoot, 'app', '(dashboard)'))) {
      for (const expr of badgeFigures(readFileSync(file, 'utf8'))) found.push(`${file.slice(uxRoot.length + 1)}: ${expr}`);
    }
    assert.deepEqual(found, [], 'a page draws a badge that counts what she has written or attended');
  });
  test('the badge sweep catches a planted count', () => {
    assert.deepEqual(badgeFigures('<Count>{entries.length}</Count>'), ['entries.length']);
    assert.deepEqual(badgeFigures('<Toggle badge={sessions.length} />'), ['sessions.length']);
    assert.deepEqual(badgeFigures('<Count>{open}</Count>'), [], 'a thing on file is allowed');
  });
  test('the rail sweep catches a planted count of appointments', () => {
    assert.deepEqual(metaFigures("{ label: 'Appointments', meta: String(appointments.length) }"), ['appointments.length']);
    assert.deepEqual(metaFigures('{ meta: String(open) }'), [], 'a thing on file is allowed');
  });
  test('the navigation counts only things on file, never her journal or sessions', () => {
    const counts = read(() => getNavCounts());
    for (const route of Object.keys(counts)) assert.ok(['/people', '/loops'].includes(route), `${route} is counted in the navigation`);
  });
});

// TML-001: the timeline shows each period's shape first, then its events; the
// filters touch only the entries below.
describe('the timeline shows the eras above the entries, unfiltered (TML-001)', () => {
  const page = readFileSync(join(uxRoot, 'app', '(dashboard)', 'timeline', 'page.jsx'), 'utf8');
  test('the Eras section is rendered before the Entries section', () => {
    const eras = page.indexOf('title="Eras"');
    const entries = page.indexOf('title="Entries"');
    assert.ok(eras > -1 && entries > -1 && eras < entries, 'Eras must come above Entries');
  });
  test('the filters are handed to the entries list and never to the eras', () => {
    const erasBlock = page.slice(page.indexOf('title="Eras"'), page.indexOf('title="Entries"'));
    assert.doesNotMatch(erasBlock, /\b(tag|type|filterFrom)\b/, 'a filter reaches the eras');
    assert.match(page, /<TimelineList[^>]*tag=\{tag\}[^>]*type=\{type\}/, 'the entries list takes the filters');
  });
  test('the read returns the eras of the sample whole', () => {
    assert.ok(read(() => getTimeline()).eras, 'the sample has eras');
  });
});

// TML-003: an event shows when it happened and, where they differ, when it was told.
describe('a late telling carries its own date (TML-003)', () => {
  const timelineOf = (rows) => {
    const dir = makeTemp('tl-');
    try {
      mkdirSync(join(dir, 'core'), { recursive: true });
      writeFileSync(join(dir, 'core', 'timeline.md'), `# Timeline\n\n## Entries\n\n| Date | Type | Tags | What happened | File |\n|---|---|---|---|---|\n${rows}\n`);
      return inRecord({ dir }, () => getTimeline()).entries;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  test('an entry with both dates keeps both; one with a single date implies no other', () => {
    const entries = timelineOf('| 2026-03-01 (told 2026-03-20) | event | work | said late | |\n| 2026-04-02 | event | work | said same day | |');
    const late = entries.find((e) => e.what === 'said late');
    const same = entries.find((e) => e.what === 'said same day');
    assert.equal(late?.date, '2026-03-01');
    assert.equal(late?.told, '2026-03-20');
    assert.equal(same?.date, '2026-04-02');
    assert.equal(same?.told, null);
  });
  test('the entry view shows the told date only when there is one', () => {
    const src = readFileSync(join(uxRoot, 'components', 'ui', 'TimelineEntry.jsx'), 'utf8');
    assert.match(src, /entry\.told\s*&&/, 'the told date is conditional');
  });
  // Design 2 is instruction: the rule that gives the view a told date to show
  // must stay in the constitution's timeline section, in the form the read parses.
  test('the constitution keeps the rule that marks a late telling', () => {
    const rule = readFileSync(join(uxRoot, '..', 'CLAUDE.md'), 'utf8').match(/^Add `\(told YYYY-MM-DD\)`[^\n]*$/m);
    assert.ok(rule, 'CLAUDE.md no longer tells the session to add (told YYYY-MM-DD)');
    assert.match(rule[0], /describes something that happened earlier/);
    const example = '| 2026-03-01 (told 2026-03-20) | event | work | x | |';
    assert.match(example, /\(told\s+(\d{4}-\d{2}-\d{2})\)/, 'the marked form is the one the read parses');
  });
});

// TML-004: a line the record marks [inferred] stays marked as a reading in the view.
describe('a reading stays marked as not her account (TML-004)', () => {
  const timelineOf = (rows) => {
    const dir = makeTemp('tl-');
    try {
      mkdirSync(join(dir, 'core'), { recursive: true });
      writeFileSync(join(dir, 'core', 'timeline.md'), `# Timeline\n\n## Entries\n\n| Date | Type | Tags | What happened | File |\n|---|---|---|---|---|\n${rows}\n`);
      return inRecord({ dir }, () => getTimeline()).entries;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  test('an [inferred] line is flagged and an unmarked one is not', () => {
    const entries = timelineOf('| 2026-03-01 | event | work | [inferred] seemed tired | |\n| 2026-03-02 | event | work | she said she was tired | |');
    assert.equal(entries.find((e) => e.what.includes('seemed tired'))?.inferred, true);
    assert.equal(entries.find((e) => e.what.includes('she said'))?.inferred, false);
  });
  test('the entry view strips the mark from the sentence and shows a reading tag', () => {
    const src = readFileSync(join(uxRoot, 'components', 'ui', 'TimelineEntry.jsx'), 'utf8');
    assert.match(src, /replace\(\/\\\[inferred\\\]/, 'the mark is stripped from the sentence');
    assert.match(src, /entry\.inferred\s*&&/, 'the reading tag is conditional on the flag');
  });
  // "Survives every filter": the filter only drops entries, it never rebuilds
  // one, and every surface that shows a line shows it through TimelineEntry.
  test('the filter keeps entries whole, so the flag survives any tag or type', () => {
    const src = readFileSync(join(uxRoot, 'app', '(dashboard)', 'timeline', 'TimelineList.jsx'), 'utf8');
    assert.match(src, /entries\.filter\(/, 'the filter selects among the read entries');
    assert.match(src, /<TimelineEntry\s+entry=\{entry\}/, 'each shown entry is passed whole to TimelineEntry');
    assert.doesNotMatch(src, /\{\s*\.\.\.entry\b/, 'no entry is rebuilt before it is shown');
  });
  test('every view that shows a timeline line shows it through TimelineEntry', () => {
    for (const rel of [['app', '(dashboard)', 'page.jsx'], ['app', '(dashboard)', 'people', '[slug]', 'page.jsx'], ['app', '(dashboard)', 'timeline', 'TimelineList.jsx']]) {
      const src = readFileSync(join(uxRoot, ...rel), 'utf8');
      assert.match(src, /<TimelineEntry\b[^\n>]*\bentry=\{entry\}/, `${rel.join('/')} shows a line through TimelineEntry`);
      assert.doesNotMatch(src, /className="tl-what"/, `${rel.join('/')} draws no line of its own`);
    }
  });
});

// NOW-004: a snapshot whose file is missing says so; one that is present but
// empty is just absent. The two must not read alike.
describe('a missing snapshot is told apart from an empty one (NOW-004)', () => {
  const homeOf = (files) => {
    const dir = makeTemp('home-');
    try {
      mkdirSync(join(dir, 'core', 'state'), { recursive: true });
      for (const [rel, body] of Object.entries(files)) writeFileSync(join(dir, rel), body);
      return inRecord({ dir }, () => getHome());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  test('with now.md removed the home read reports it missing', () => {
    assert.equal(homeOf({ 'core/state/log.md': '# Log\n' }).now?.missing, true);
  });
  test('with now.md present but empty it is not reported missing', () => {
    const now = homeOf({ 'core/state/now.md': '# Now\n' }).now;
    assert.ok(!now?.missing, 'an empty file is ordinary, not a fault');
    assert.equal(now?.filled, false);
  });
  test('the home page renders a notice for a missing source', () => {
    const src = readFileSync(join(uxRoot, 'app', '(dashboard)', 'page.jsx'), 'utf8');
    assert.match(src, /now\?\.missing/, 'home page branches on the missing flag');
  });
});

// NOW-006: everything lifted onto home ends with the path it came from.
describe('every home section names its source (NOW-006)', () => {
  const src = readFileSync(join(uxRoot, 'app', '(dashboard)', 'page.jsx'), 'utf8');
  for (const [title, path] of [
    ['Lately', 'data/core/timeline.md'],
    ['Coming up', 'data/core/calendar/calendar.md'],
    ['For the next appointment', 'data/core/state/open_loops.md'],
    ['People', 'data/core/people/'],
  ]) {
    test(`${title} carries a Source line`, () => {
      const from = src.lastIndexOf(`title="${title}"`);
      assert.ok(from >= 0, `home page has ${title}`);
      const next = src.indexOf('<SectionHead', from + 1);
      const block = src.slice(from, next < 0 ? src.length : next);
      assert.ok(block.includes(`<Source path="${path}"`), `${title} ends with its source ${path}`);
    });
  }
});
