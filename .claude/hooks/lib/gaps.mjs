// Gaps in what is known about her, found by code, asked one at a time (card A-180).
//
// "Keep looking over what you know about me for gaps: something missing, out of date
// or unclear that would change how you help. When you find one, ask me, the one that
// matters most, one question at a time, at a natural pause in an ordinary chat. At
// most one such question a chat session. Keep my answer so you never ask the same
// thing twice."
//
// The finder reads the record and lists candidate gaps, ranked; the session brief
// (session/session-brief.mjs) hands an everyday chat the top one that is due, on a
// day that is not hard, at an hour that is not late, when no gap was asked today.
// What she said to each is kept in data/core/state/gaps.json, so nothing is asked twice:
//
//   asked     put to her; asked again no sooner than two weeks on, if never settled
//   answered  never asked again (her answer goes where it belongs in the record)
//   not_now   asked again on or after `ask_after` (two weeks, or the date she named)
//   declined  never asked again
//
// Five kinds of gap, each a question about her life, never about how this works:
//
//   passed    a date on the calendar's "Coming up" table has passed, nothing says how it went
//   person    someone in the current snapshot whose page has said nothing new for three weeks
//   clinical  her medication was last mentioned six weeks ago or more
//   unknown   a line marked not yet known, not confirmed, not told, or with a time not given
//   loop      an open thread with no date at all
//
// Never a gap: anything under a "Handle with care", "Don't push on", "What lands badly"
// or a hard-dates heading; any line saying she asked to drop it or not to be asked; any
// gap sharing a word with those; anything about safety (a crisis, harm, violence). Money
// words follow a "money" line there. Over-skipping is the safe side: a skipped gap waits
// for her to raise it; a wrong one asks about what she put down.
//
// Pure where it can be (text in, gaps out); the file reads are in findGaps. No
// dependencies, like everything under hooks/. Tested by lib/test-gaps.mjs.
//
//   node .claude/hooks/lib/gaps.mjs list [--all] [--json]   ranked gaps; --all shows settled ones
//   node .claude/hooks/lib/gaps.mjs brief                    the line the brief would give, or why none
//   node .claude/hooks/lib/gaps.mjs asked <id>               as it is put to her
//   node .claude/hooks/lib/gaps.mjs answered <id>            once her answer is kept in the record
//   node .claude/hooks/lib/gaps.mjs not-now <id> [YYYY-MM-DD] she said not now (default: two weeks)
//   node .claude/hooks/lib/gaps.mjs declined <id>            she would rather not say
//   (each takes --data <dir> and --today YYYY-MM-DD, for tests)

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = 'core';
export const STATE_PATH = (dataDir) => join(dataDir, CORE, 'state', 'gaps.json');

const DAY = 86400e3;
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How long a person's page may say nothing new while they are in the snapshot. */
export const QUIET_PERSON_DAYS = 21;
/** How long medication may go unmentioned before asking whether it still stands. */
export const CLINICAL_STALE_DAYS = 42;
/** How far back a passed calendar date is still worth asking about. */
export const PASSED_WINDOW_DAYS = 60;
/** How long a "not now", or a question asked and never settled, waits by default. */
export const NOT_NOW_DAYS = 14;

// ── text ──────────────────────────────────────────────────────────────────────

const read = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

/** Markdown down to its words: links to their text, emphasis and code marks gone. */
export function plain(text) {
  return String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*[-+]\s+\[[ xX]\]\s*/, '')
    .replace(/^\s*[-+]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day, n) => iso(Date.parse(`${day}T12:00:00Z`) + n * DAY);
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);

/** Every full date in a text, as YYYY-MM-DD: ISO ones, and "7 Nov 2026" or "7 to 8 Nov 2026" (the later day). */
export function datesIn(text) {
  const out = [];
  const s = String(text ?? '');
  for (const m of s.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of s.matchAll(/\b(\d{1,2})(?:\s*(?:to|–|-)\s*(\d{1,2}))?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})\b/g)) {
    const month = MONTHS.indexOf(m[3].toLowerCase());
    if (month < 0) continue;
    const day = Number(m[2] ?? m[1]);
    if (day < 1 || day > 31) continue;
    out.push(`${m[4]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return out.filter((d) => !Number.isNaN(Date.parse(d)));
}

export const dayLabel = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
};

/** A short subject: parentheticals and trailing punctuation gone, cut at a word near `max`. */
export function subject(text, max = 90) {
  let s = plain(text).replace(/\([^)]*\)/g, ' ').replace(/\([^)]*$/, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/[\s.;:,–—-]+$/, '');
  if (s.length > max) s = `${s.slice(0, max).replace(/\s+\S*$/, '')}…`;
  return s;
}

// ── what is never asked ──────────────────────────────────────────────────────

/** Headings whose lines are never the source of a gap: what to handle with care, what lands badly, hard dates. */
export const SKIP_HEADING = /handle with care|don'?t push|lands badly|asked to drop|not to (raise|ask)|\bhard\b|\bcold\b|\bparked\b/i;
/** Headings whose lines name topics she asked to be left alone: a gap touching one is never asked. */
export const FENCE_HEADING = /handle with care|don'?t push|asked to drop|not to (raise|ask)|leave alone/i;
/** A line saying she asked for a thing to be left alone. */
export const DROP_LINE = /\b(asked (me )?to (drop|stop|leave)|asked not to|don'?t (re-?open|reopen|ask|push|mention|raise|bring (it )?up|lead)|never (lead|raise|ask|mention)|wait for (him|her|them) to|not to be asked|leave it|off limits)\b/i;
/** Safety ground: never opened by a gap question; the crisis floor and she lead there. */
export const SENSITIVE = /\b(suicid\w*|self[- ]?harm\w*|kill\w*|violen\w*|abus\w*|assault\w*|rape\w*|hit|hitting|slap\w*|police|crisis|overdos\w*|weapon\w*|die|died|dying|death|dead|unsafe|panic\w*)\b/i;
/** Words about how this works, never in a question to her. */
export const SYSTEM_WORDS = /\b(file|files|record|records|recorded|data|system|harness|repo|repository|session|sessions|hook|hooks|skill|skills|spec|specs|folder|markdown|json|script|chat|chats|gap|gaps|profile|log|logged)\b|\.md\b|\.json\b/i;

/** Word families: a fenced topic in one fences every word of its family. */
export const FAMILIES = {
  money: /\b(money|pay|pays|paying|payments?|paid|bank\w*|cost\w*|price\w*|debt\w*|loan\w*|fees?|deposit\w*|refund\w*|bills?|salar\w*|financ\w*|afford\w*|owe[ds]?|owing|savings?|cash)\b/i,
  medication: /\b(medication\w*|medicine\w*|meds|dose[sd]?|dosage|stimulants?|\d+\s?mg|pills?|tablets?|prescri\w*)\b/i,
};

const STOP = new Set(('about above after again against because before being below between could doesn either every first going would should there their these those thing things which while where whether other others really still since until never always asked question questions request requests words something someone anything nothing everything people person today tomorrow yesterday month months weeks years later earlier right without within maybe often second third great little ' +
  'answer answered answers wants wanted happy please thank thanks start started topic topics reply replies told tells dates whole makes leave keeps knows confirm confirmed unconfirmed dont correct ' +
  'with that from what when this them they have will been were your more some just like only also into over then than very much does done each even here hers his him her she says said take took make made good well time once ever away back down off our out own the and for not but all any can may now ask lead push open date days week year given known still unknown')
  .split(' '));

const wordsOf = (text, min = 5) => plain(text).toLowerCase().match(new RegExp(`[a-z][a-z'’]{${min - 1},}`, 'g'))?.map((w) => w.replace(/['’]s$/, '').replace(/['’]/g, '')) ?? [];
const stem = (w) => w.slice(0, 6);

/** The words that name a fenced topic: no stop words, no -ing verbs, no names (a name fences nothing on its own). */
function topicStems(text) {
  const names = new Set((plain(text).match(/(?<![.!?:]\s|^)\b[A-Z][a-z]+\b/g) ?? []).map((n) => n.toLowerCase()));
  return wordsOf(text, 4).filter((w) => !STOP.has(w) && !/ing$/.test(w) && !names.has(w)).map(stem);
}

/** A drop line's topic: its bold label or the words before its first colon, else its first sentence, a leading date left out. */
function dropTopic(text) {
  const bold = /^\s*(?:[-+*]\s+)?(?:\[[ xX]\]\s*)?\*\*([^*]+)\*\*/.exec(text)?.[1];
  if (bold) return bold;
  const t = plain(text).replace(/^\d{1,2} [A-Za-z]{3}[a-z]* \d{4}:\s*|^\d{4}-\d{2}-\d{2}:?\s*/, '');
  const colon = /^([^:.]{3,40}):/.exec(t)?.[1];
  if (colon && !datesIn(colon).length) return colon;
  return t.split(/(?<=[.;])\s/)[0];
}

/**
 * What she asked to be left alone, from [relPath, text] pairs: the lines under a fencing
 * heading (whole), and any other line or loop item that says so itself (its topic only).
 * Returns { lines, stems, names, families }: names are the people a fenced line mentions,
 * which only keeps a "how are things with them" question from being asked.
 */
export function careFrom(texts) {
  const lines = [];
  const stems = new Set();
  const names = new Set();
  const families = new Set();
  const take = (topic, whole) => {
    lines.push(whole);
    for (const s of topicStems(topic)) stems.add(s);
    for (const [name, re] of Object.entries(FAMILIES)) if (re.test(plain(topic))) families.add(name);
    for (const m of plain(whole).matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]{2,})\b/g)) names.add(m[1].toLowerCase());
  };
  for (const [, text] of texts) {
    let fence = false;
    for (const block of blocks(text)) {
      if (block.heading !== undefined) {
        fence = FENCE_HEADING.test(block.heading);
        continue;
      }
      if (fence) {
        if (isTableRow(block.text)) {
          const c = cells(block.text);
          if (/^(date|topic)$/i.test(c[0] ?? '')) continue;
          // A table of topics: the topic cell's first sentence; a date cell is no topic.
          const topic = (datesIn(c[0]).length && c[1] ? c[1] : c[0]).split(/(?<=[.;])\s/)[0];
          take(topic, block.text);
        } else if (!/^_.*_$/.test(block.text)) take(block.text, block.text);
      } else if (DROP_LINE.test(block.text)) take(dropTopic(block.text), block.text);
    }
  }
  return { lines, stems, names, families };
}

/** Why a gap's words are fenced off (safety ground, or a topic she asked to drop), or null. */
export function fenced(text, care) {
  const t = plain(text);
  if (SENSITIVE.test(t)) return 'safety';
  for (const f of care.families) if (FAMILIES[f].test(t)) return `asked to drop (${f})`;
  for (const w of wordsOf(t, 4)) if (!STOP.has(w) && care.stems.has(stem(w))) return `asked to drop (${w})`;
  return null;
}

/**
 * A text as headings and blocks: a list item with its indented continuation is one
 * block, a table row is one, any other line is one. `heading` set means a heading line.
 */
export function blocks(text) {
  const out = [];
  let item = null;
  const flush = () => {
    if (item) out.push(item);
    item = null;
  };
  for (const line of String(text ?? '').split('\n')) {
    if (/^#{1,6}\s/.test(line)) {
      flush();
      out.push({ heading: line.replace(/^#+\s*/, '').trim() });
      continue;
    }
    if (/^\s*[-+*]\s/.test(line) && !/^\s{2,}/.test(line)) {
      flush();
      item = { text: line.trim(), checked: /^\s*[-+*]\s+\[[xX]\]/.test(line) };
      continue;
    }
    if (item && /^\s{2,}\S/.test(line)) {
      item.text += ` ${line.trim()}`;
      continue;
    }
    flush();
    if (line.trim()) out.push({ text: line.trim(), checked: false });
  }
  flush();
  return out;
}

/** The blocks of a text with the heading they sit under. */
function underHeadings(text) {
  const out = [];
  let heading = '';
  for (const b of blocks(text)) {
    if (b.heading !== undefined) heading = b.heading;
    else out.push({ ...b, heading });
  }
  return out;
}

const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isTableRow = (t) => /^\|/.test(t) && !/^\|[\s|:-]+\|?$/.test(t);

// ── the finder ───────────────────────────────────────────────────────────────

const OUTCOME = /\b(done|went|happened|cancel+ed|called off|not happening|postponed|moved to|rescheduled|update[ds]?|outcome|it was|didn'?t go|did not go)\b/i;

export const UNKNOWN_MARKS = [
  { re: /\b(time|day|date) not (yet )?(given|known|set)\b|\bnot yet (booked|set)\b/i, ask: (s) => `Do you know when yet: ${s}?` },
  { re: /\b(not (yet )?confirmed|unconfirmed|to be confirmed|tbc)\b/i, ask: (s) => `Is this settled yet: ${s}?` },
  { re: /\bnot yet told\b|\bhasn'?t told\b|\bnot told\b/i, ask: (s) => `Has it been said yet: ${s}?` },
  { re: /\b(not yet known|unknown|not known|outcome unknown|not yet named|not named|not yet recorded|not recorded|no record)\b/i, ask: (s) => `Where do things stand now: ${s}?` },
];

const gapId = (kind, source, key) => createHash('sha1').update(`${kind}|${source}|${plain(key).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)}`).digest('hex').slice(0, 8);

function files(dir, keep = () => true, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'archive' || e.name === 'archive-local') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) files(p, keep, out);
    else if (keep(p)) out.push(p);
  }
  return out;
}

const timelineLines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((l) => /^\|?\s*(\d{4}-\d{2}-\d{2})\s*[·|](.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => ({ date: m[1], text: m[2] }));

const shareWord = (a, b) => {
  const bw = new Set(wordsOf(b).filter((w) => !STOP.has(w)).map(stem));
  return wordsOf(a).some((w) => !STOP.has(w) && bw.has(stem(w)));
};

/**
 * Every candidate gap in the record at `dataDir`, ranked, highest first, settled ones
 * included (see `due` for what may be asked). `today` is her date, YYYY-MM-DD.
 * Each: { id, kind, question, why, source, score }.
 */
export function findGaps(dataDir, today, skipped = null) {
  const rel = (p) => relative(dataDir, p).replace(/\\/g, '/');
  const path = (...p) => join(dataDir, CORE, ...p);
  const now = read(path('state', 'now.md'));
  const loops = read(path('state', 'open_loops.md'));
  const calendar = read(path('calendar', 'calendar.md'));
  const talk = read(path('me', 'how_to_talk_to_me.md'));
  const timeline = [path('timeline.md'), ...files(path('timeline'), (p) => p.endsWith('.md'))].map(read).join('\n');
  const peopleDir = path('people');
  const peopleFiles = files(peopleDir, (p) => p.endsWith('.md'));
  const therapyFiles = files(join(dataDir, 'therapy'), (p) => p.endsWith('.md'));
  const journalFiles = files(path('journal'), (p) => /\d{4}-\d{2}-\d{2}/.test(basename(p)));

  const scanned = [
    ['core/state/now.md', now],
    ['core/state/open_loops.md', loops],
    ['core/calendar/calendar.md', calendar],
    ['core/me/how_to_talk_to_me.md', talk],
    ...peopleFiles.map((p) => [rel(p), read(p)]),
    ...therapyFiles.map((p) => [rel(p), read(p)]),
  ];
  const care = careFrom(scanned);
  const tl = timelineLines(timeline);
  const out = [];
  const seen = new Set();
  const add = (gap, text) => {
    const fence = fenced(`${text} ${gap.question}`, care) ?? (SYSTEM_WORDS.test(gap.question) ? 'about how this works' : null);
    if (fence) {
      skipped?.push({ kind: gap.kind, why: fence });
      return;
    }
    const id = gapId(gap.kind, gap.source, gap.key ?? text);
    if (seen.has(id)) return;
    seen.add(id);
    delete gap.key;
    out.push({ id, ...gap });
  };

  // passed: a dated row of "Coming up" now behind her, and nothing says how it went.
  let section = '';
  const calendarRows = [];
  for (const b of blocks(calendar)) {
    if (b.heading !== undefined) {
      section = b.heading;
      continue;
    }
    if (!/coming up/i.test(section) || !isTableRow(b.text)) continue;
    const c = cells(b.text);
    if (/^date$/i.test(c[0] ?? '')) continue;
    calendarRows.push({ cells: c, text: b.text });
  }
  for (const row of calendarRows) {
    const [when = '', what = '', notes = ''] = row.cells;
    const dates = datesIn(when).sort();
    const date = dates.at(-1);
    if (!date) continue;
    const since = daysBetween(date, today);
    if (since < 1 || since > PASSED_WINDOW_DAYS) continue;
    if (OUTCOME.test(`${what} ${notes}`)) continue;
    const told =
      tl.some((l) => daysBetween(date, l.date) >= 0 && daysBetween(date, l.date) <= 3 && shareWord(what, l.text)) ||
      [...journalFiles, ...therapyFiles].some((p) => {
        const d = datesIn(basename(p))[0];
        return d && daysBetween(date, d) >= 0 && daysBetween(date, d) <= 3 && shareWord(what, read(p));
      });
    if (told) continue;
    const s = subject(plain(what).split(/;\s/)[0], 80);
    if (!s) continue;
    add(
      {
        kind: 'passed',
        question: `How did it go: ${s} (${dayLabel(date)})?`,
        why: `it was on ${date} and nothing says how it went`,
        source: 'core/calendar/calendar.md',
        score: 90 - Math.min(since, 60) / 2,
        key: `${date} ${what}`,
      },
      `${what} ${notes}`,
    );
  }

  // person: in the snapshot now, and their page has said nothing new for three weeks.
  const people = new Map();
  for (const p of peopleFiles) {
    const r = relative(peopleDir, p).replace(/\\/g, '/');
    if (r === 'README.md') continue;
    const slug = r.includes('/') ? r.split('/')[0] : r.replace(/\.md$/, '');
    if (!people.has(slug)) people.set(slug, []);
    people.get(slug).push(p);
  }
  for (const [slug, pages] of people) {
    if (!new RegExp(`\\b${slug}\\b`, 'i').test(plain(now))) continue;
    if (care.names.has(slug)) continue;
    const front = pages.find((p) => basename(p) === 'README.md' || basename(p) === `${slug}.md`) ?? pages[0];
    const title = /^#\s+(.+)$/m.exec(read(front))?.[1]?.trim();
    const name = title && title.split(/\s+/).length <= 3 && !/[—–:|]/.test(title) ? plain(title) : slug[0].toUpperCase() + slug.slice(1);
    const dated = [
      ...pages.flatMap((p) => datesIn(read(p))),
      ...tl.filter((l) => new RegExp(`\\b${slug}\\b`, 'i').test(l.text)).map((l) => l.date),
    ].filter((d) => d <= today);
    const last = dated.sort().at(-1);
    if (!last) continue;
    const quiet = daysBetween(last, today);
    if (quiet < QUIET_PERSON_DAYS) continue;
    add(
      {
        kind: 'person',
        question: `How are things with ${name} these days?`,
        why: `${name} is in the current picture, but nothing new about them since ${last}`,
        source: rel(front),
        score: 55 + Math.min(quiet - QUIET_PERSON_DAYS, 30) / 3,
        key: slug,
      },
      name,
    );
  }

  // clinical: medication, last mentioned six weeks ago or more.
  const MED = /\b(medication|medicine|dose|dosage|\d+\s?mg)\b/i;
  const medDates = [
    ...therapyFiles.filter((p) => /med/i.test(basename(p))).flatMap((p) => datesIn(read(p))),
    ...tl.filter((l) => MED.test(l.text)).map((l) => l.date),
    ...plain(now).split(/(?<=\.)\s/).filter((l) => MED.test(l)).flatMap((l) => datesIn(l)),
  ].filter((d) => d <= today);
  const lastMed = medDates.sort().at(-1);
  if (lastMed && daysBetween(lastMed, today) >= CLINICAL_STALE_DAYS) {
    add(
      {
        kind: 'clinical',
        question: `Has anything changed with your medication since ${dayLabel(lastMed)}?`,
        why: `the last word on medication is from ${lastMed}`,
        source: 'therapy/',
        score: 70,
        key: 'medication',
      },
      'medication',
    );
  }

  // unknown: a line marked not known, not confirmed, not told, or with no time given.
  // Only the working pages and each person's front page, and only a list item or a table
  // row: a paragraph or her quoted words are not a gap to put back to her.
  const fronts = new Set([...people].map(([slug, pages]) => rel(pages.find((p) => basename(p) === 'README.md' || basename(p) === `${slug}.md`) ?? pages[0])));
  for (const [source, text] of scanned) {
    if (!/^core\/(state\/now|state\/open_loops|calendar\/calendar)\.md$/.test(source) && !fronts.has(source)) continue;
    for (const b of underHeadings(text)) {
      if (b.checked || SKIP_HEADING.test(b.heading) || /archive|next session|appointment|therapist|clinician|psychiatrist|doctor/i.test(b.heading)) continue;
      if (!isTableRow(b.text) && !/^[-+*]\s/.test(b.text)) continue;
      if (/["“”]/.test(b.text)) continue;
      const mark = UNKNOWN_MARKS.find((m) => m.re.test(b.text));
      if (!mark) continue;
      let gist = b.text;
      if (isTableRow(b.text)) {
        const c = cells(b.text);
        if (/^date$/i.test(c[0] ?? '')) continue;
        const dates = datesIn(c[0]).sort();
        // A passed row is the passed kind's; only one still ahead, or undated, is unknown.
        if (source.endsWith('calendar.md') && dates.length && daysBetween(dates.at(-1), today) >= 1) continue;
        const dateCell = c.length > 1 && (dates.length || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\d/i.test(c[0]));
        gist = dateCell ? c[1] : c[0];
      } else {
        // The sentence the mark is in, from its start.
        const sentence = plain(b.text).split(/(?<=[.;])\s/).find((x) => mark.re.test(x)) ?? plain(b.text);
        const before = sentence.slice(0, sentence.search(mark.re));
        gist = before.replace(/[\s,;:(—–-]+$/, '').length >= 12 ? before : sentence;
      }
      gist = plain(gist).replace(/^(\d{1,2} [A-Za-z]{3}[a-z]* \d{4}|\d{4}-\d{2}-\d{2})\s*:\s*/, '').split(/;\s/)[0];
      const s = subject(gist, 80);
      if (!s || s.length < 6) continue;
      add(
        {
          kind: 'unknown',
          question: mark.ask(s),
          why: 'it is marked as not yet known',
          source,
          score: 45 + (source === 'core/state/now.md' ? 10 : 0),
          key: b.text,
        },
        b.text,
      );
    }
  }

  // loop: an open thread with no date at all, outside the notes for her clinician.
  for (const b of underHeadings(loops)) {
    if (!/^\s*[-+*]\s+\[ \]/.test(b.text) || b.checked) continue;
    if (SKIP_HEADING.test(b.heading) || /appointment|therapist|clinician|psychiatrist|doctor/i.test(b.heading)) continue;
    if (datesIn(b.text).length || /\b(19|20)\d{2}\b/.test(b.text)) continue;
    if (UNKNOWN_MARKS.some((m) => m.re.test(b.text))) continue;
    const s = subject(b.text, 80);
    if (!s || s.length < 6) continue;
    add({ kind: 'loop', question: `Where do things stand now: ${s}?`, why: 'an open thread with no date on it', source: 'core/state/open_loops.md', score: 30, key: b.text }, b.text);
  }

  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

// ── what she said ────────────────────────────────────────────────────────────

export function readState(dataDir) {
  try {
    const j = JSON.parse(readFileSync(STATE_PATH(dataDir), 'utf8'));
    return { gaps: j && typeof j.gaps === 'object' && j.gaps ? j.gaps : {} };
  } catch {
    return { gaps: {} };
  }
}

export function writeState(dataDir, state) {
  const file = STATE_PATH(dataDir);
  mkdirSync(dirname(file), { recursive: true });
  const body = {
    about: 'Gap questions put to her (card A-180) and what she said, so none is asked twice. asked: put to her; answered and declined: never again; not_now: not before ask_after. Kept by .claude/hooks/lib/gaps.mjs.',
    gaps: state.gaps,
  };
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
}

/** Whether a gap may be asked today, given what she said: null if it may, else why not. */
export function heldBy(entry, today) {
  if (!entry) return null;
  if (entry.status === 'answered') return 'answered';
  if (entry.status === 'declined') return 'declined';
  const after = entry.ask_after ?? (entry.asked ? addDays(entry.asked, NOT_NOW_DAYS) : null);
  if (after && today < after) return entry.status === 'not_now' ? `not now, until ${after}` : `asked ${entry.asked}, waiting until ${after}`;
  return null;
}

/** The gaps that may be asked today, best first. */
export const due = (gaps, state, today) => gaps.filter((g) => !heldBy(state.gaps[g.id], today));

/** Whether a gap question was already put to her today, or in this session since yesterday. */
export function askedRecently(state, today, session = '') {
  const yesterday = addDays(today, -1);
  return Object.values(state.gaps).some((e) => e?.asked === today || (session && e?.session === session && e?.asked >= yesterday));
}

/** Set what she said to one gap. `status` is asked, answered, not_now or declined. */
export function settle(dataDir, id, status, { today, session = '', askAfter, question } = {}) {
  const state = readState(dataDir);
  const prev = state.gaps[id] ?? {};
  const entry = { ...prev, status, updated: today };
  if (question && !entry.question) entry.question = question;
  if (status === 'asked') {
    entry.asked = today;
    if (session) entry.session = session;
    delete entry.ask_after;
  }
  if (status === 'not_now') entry.ask_after = askAfter ?? addDays(today, NOT_NOW_DAYS);
  if (status === 'answered' || status === 'declined') delete entry.ask_after;
  if (!entry.asked && status !== 'asked') entry.asked = today;
  state.gaps[id] = entry;
  writeState(dataDir, state);
  return entry;
}

// ── the brief's one line ─────────────────────────────────────────────────────

/** A crisis or panic session today or yesterday, by the log's session lines: a hard day. */
export function hardDay(log, today) {
  const yesterday = addDays(today, -1);
  return String(log ?? '')
    .split('\n')
    .map((l) => /^\|?\s*(\d{4}-\d{2}-\d{2})\s*·\s*([^·|]+?)\s*·\s*([^|]*?)\s*\|?\s*$/.exec(l.trim()))
    .filter(Boolean)
    .some((m) => (m[1] === today || m[1] === yesterday) && (/^(crisis|panic)\b/i.test(m[2].trim()) || /\b(hard day|bad night|crisis|panic|unsafe)\b/i.test(m[3])));
}

/** Late where she is: the opening's own hours (lib/opening.mjs), 23:00 to 05:00. */
export const lateAt = (hour) => hour >= 23 || hour < 5;

/**
 * The brief's gap line, or { line: null, why } when none is given. `local` is her local
 * time, "YYYY-MM-DDTHH:MM…". Gates, in order: not an everyday chat, a question still owed
 * by the profile, a hard day, late at night, a gap asked already today (or this session),
 * and nothing due.
 */
export function briefGap({ dataDir, local, session = '', everyday = true, profileOwed = 0, log }) {
  const today = local.slice(0, 10);
  if (!everyday) return { line: null, why: 'not an everyday chat' };
  if (profileOwed) return { line: null, why: 'a profile question is still owed, and goes first' };
  const logText = log ?? read(join(dataDir, CORE, 'state', 'log.md'));
  if (hardDay(logText, today)) return { line: null, why: 'a hard day (a crisis or panic session today or yesterday)' };
  if (lateAt(Number(local.slice(11, 13)))) return { line: null, why: 'late at night where she is' };
  const state = readState(dataDir);
  if (askedRecently(state, today, session)) return { line: null, why: 'a gap question was already asked today' };
  const gap = due(findGaps(dataDir, today), state, today)[0];
  if (!gap) return { line: null, why: 'no gap is due' };
  const cli = 'node .claude/hooks/lib/gaps.mjs';
  return {
    gap,
    line:
      `A GAP TO ASK ABOUT (A-180), the one that matters most now, in an everyday chat only: hear what she came with first; then, at a calm natural pause, ask this once, in your own warm words, as a question about her life: "${gap.question}" (why it matters: ${gap.why}). ` +
      `At most one gap question this session. Not in a crisis, on a hard day or in a hard moment, and not if she has asked to drop it; then leave it. ` +
      `As you ask it, run \`${cli} asked ${gap.id}\`. Keep her answer where it belongs in her record, then \`${cli} answered ${gap.id}\`; "not now": \`${cli} not-now ${gap.id}\` (two weeks, or add the date she names); would rather not: \`${cli} declined ${gap.id}\`. Never mention any of this to her.`,
  };
}

// ── command line ─────────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const dataOpt = flag('--data');
  const todayOpt = flag('--today');
  const json = args.includes('--json');
  const all = args.includes('--all');
  const [cmd = 'list', id, when] = args.filter((a) => !a.startsWith('--'));
  const { readProfile, zonedDateTime } = await import('./profile-schema.mjs');
  const dataDir = dataOpt ?? (await import('./hook.mjs')).dataDir;
  const tz = readProfile(read(join(dataDir, 'PROFILE.yaml'))).value?.timezone ?? 'UTC';
  const local = todayOpt ? `${todayOpt}T12:00` : zonedDateTime(new Date(), tz);
  const today = local.slice(0, 10);
  const session = String(process.env.CLAUDE_CODE_REMOTE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || '');
  const gaps = findGaps(dataDir, today);
  const state = readState(dataDir);

  if (cmd === 'list') {
    const shown = gaps.map((g) => ({ ...g, held: heldBy(state.gaps[g.id], today) })).filter((g) => all || !g.held);
    if (json) console.log(JSON.stringify(shown, null, 2));
    else if (!shown.length) console.log('gaps: none due');
    else for (const g of shown) console.log(`${g.id}  ${g.kind.padEnd(8)} ${String(Math.round(g.score)).padStart(3)}  ${g.question}${g.held ? `  [${g.held}]` : ''}`);
  } else if (cmd === 'brief') {
    const r = briefGap({ dataDir, local, session });
    console.log(r.line ?? `gaps: no line (${r.why})`);
  } else if (['asked', 'answered', 'not-now', 'declined'].includes(cmd)) {
    const gap = gaps.find((g) => g.id === id);
    if (!id || (!gap && !state.gaps[id])) {
      console.log(`gaps: no gap ${id ?? '(none given)'}; run \`node .claude/hooks/lib/gaps.mjs list --all\` for the ids`);
      process.exit(1);
    }
    if (cmd === 'not-now' && when && !/^\d{4}-\d{2}-\d{2}$/.test(when)) {
      console.log('gaps: the date for not-now is YYYY-MM-DD');
      process.exit(1);
    }
    const status = cmd === 'not-now' ? 'not_now' : cmd;
    const entry = settle(dataDir, id, status, { today, session, askAfter: when, question: gap?.question });
    console.log(`gaps: ${id} ${status}${entry.ask_after ? ` until ${entry.ask_after}` : ''}`);
  } else {
    console.log('gaps: list | brief | asked <id> | answered <id> | not-now <id> [YYYY-MM-DD] | declined <id>');
    process.exit(1);
  }
}
