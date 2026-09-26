import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activeDir } from '@/lib/data-dir';
import { fromFile } from '@/lib/file-cache';
import matter from 'gray-matter';
import { load as parseYaml } from 'js-yaml';
import { daysAway, daysUntilRecurring, todayIn, yearOf } from '@/lib/dates';
import {
  dropLeadingH1,
  fileHasContent,
  renderBody,
  sections,
  stripComments,
  table,
} from '@/lib/markdown';
import { isLegacyProfile, parseProfile, QUESTIONS, validateRecordConfig } from '../../.claude/hooks/lib/profile-schema.mjs';
import { agree, caps, pronouns } from '@/lib/pronouns';
import { parseCrisisContacts } from '@/lib/safety.mjs';

// The read layer over the record — the inner half of it.
//
// Import lib/content.js, not this file. That one decides WHICH record a request
// is reading and enters its scope; this one does the reading and asks
// activeDir() where to read from. Calling in here directly skips the switch and
// always reads hers, which is safe but is never what a view meant.
//
// Everything here reads markdown off disk at request time. There is no database
// and no build step that bakes a copy in, so a line written into timeline.md
// during a session is on the next page load. That is the whole point: the record
// and the thing that displays it are never two different versions of the truth.
//
// NOTHING IN THIS FILE WRITES. The dashboard is a window, not a second author.
// Her record has exactly one writer — the agent she talks to — and a read surface
// that could edit it would be a second, unattributed one.
//
// There is exactly one exception in the whole app, and it is deliberately not
// here: lib/avatar.js, which saves the picture she chooses for herself. It is
// its own module for that reason — so the carve-out is one small file that can
// be read in full, rather than a write hiding among two hundred lines of reads.
// It is the one exception DSH-002 admits — "The single exception to DSH-001 is
// a thing she made rather than said" — and nothing else in this app may write.

// ── Finding the record ──────────────────────────────────────────────────────
//
// One resolver, in lib/data-dir.js, shared with the one other module that
// touches the folder. Two copies of "where is the record" is the shape of bug
// where the dashboard reads one folder and writes into another.
//
// activeDir() rather than a constant, because there are two records now and the
// choice is per request. It is a call, not an argument threaded through every
// function in this file, so that nothing in here has to remember to pass it on.

// ── Cache ───────────────────────────────────────────────────────────────────
// Keyed on mtime, so a file rewritten mid-session re-parses and an untouched one
// costs a stat() rather than a read and a markdown pass. That mechanism is
// lib/file-cache.js now, shared with the harness rather than written out once
// per reader here — and its `key` is what lets one path hold both a parsed
// markdown file and a parsed YAML one without either answering for the other.
//
// A read that THROWS is deliberately not cached: fromFile stores what build
// returns, so an exception leaves the entry absent and the next request tries
// again. That is the behaviour a transient IO error wants. A parse that fails
// and returns null IS cached — see readConfig, where null is the answer rather
// than the absence of one.

function readFile(relative) {
  const path = join(activeDir(), relative);
  if (!existsSync(path)) return null;

  try {
    return fromFile(path, 'record-md', () => parseRecordFile(path, relative));
  } catch {
    return null;
  }
}

// Everything readFile does once per version of a file. Separate so the cache
// wrapper above stays one line and this stays the part worth reading.
//
// It lets readFileSync throw rather than catching it, which is what keeps a
// failed read out of the cache.
function parseRecordFile(path, relative) {
  const raw = readFileSync(path, 'utf8');

  // gray-matter, because a file may one day carry frontmatter even though none
  // does today. A file without it returns its whole body, so this costs nothing.
  const parsed = matter(raw);
  const data = parsed.data;
  // Commented-out templates are stripped once, here at the door, so that section
  // parsing, the emptiness check and rendering all see the same file — the one
  // without the scaffolding in it.
  const content = stripComments(parsed.content);
  const value = {
    path: relative,
    raw: content,
    meta: data ?? {},
    filled: fileHasContent(content),
    // `updated` from frontmatter if present, otherwise from the "_Last updated:
    // YYYY-MM-DD_" line the templates use. Never from the filesystem mtime: a
    // clone, a checkout or a sync rewrites that, and a record that claims to have
    // changed when it did not is worse than one that says nothing.
    updated:
      data?.updated ??
      /_Last updated:\s*(\d{4}-\d{2}-\d{2})_/.exec(content)?.[1] ??
      null,
  };

  return value;
}

function listDir(relative, { extension = '.md', skip = ['README.md'] } = {}) {
  const path = join(activeDir(), relative);
  if (!existsSync(path)) return [];
  try {
    return readdirSync(path)
      .filter((f) => f.endsWith(extension) && !skip.includes(f) && !f.startsWith('.'))
      .sort();
  } catch {
    return [];
  }
}

// A file rendered for display: its HTML, whether anything is actually in it, and
// where it came from. `titled` drops the file's own h1 when the view supplies the
// heading itself.
//
// Cached on the same mtime key as readFile, because the RAW read was never the
// expensive part — the markdown pass is. One request for the home view calls
// getPeople() three times over (the nav counts, the people strip, the blank
// check), and before this every one of those re-parsed every person's file from
// scratch. The file cache underneath made the disk read free and left the work
// that actually costs something to run three times.
const rendered = new Map();

function render(relative, { titled = true } = {}) {
  const file = readFile(relative);
  if (!file) return null;

  // Keyed on the ABSOLUTE path, not the relative one: both records have a
  // state/now.md, and a key that only named the file would hand the sample's
  // rendering back for hers the moment the switch was flipped.
  const key = `${join(activeDir(), relative)}::${titled}`;
  const hit = rendered.get(key);
  // `file` is the cached object identity from readFile, so an unchanged file
  // hands back the same reference and this comparison is the mtime check without
  // stat()ing twice.
  if (hit && hit.file === file) return hit.value;

  const html = renderBody(file.raw);
  const value = {
    ...file,
    html: titled ? dropLeadingH1(html) : html,
    // The first `# Heading`, so a view can name a file without hardcoding what it
    // is called.
    title: /^#\s+(.+?)\s*$/m.exec(file.raw)?.[1] ?? null,
  };

  rendered.set(key, { file, value });
  return value;
}

// ── Now ─────────────────────────────────────────────────────────────────────

// The snapshot, read first in every session and first on this page. Returned as
// its sections rather than one blob, so the home view can give "How she's doing"
// the weight it has in the file and let the rest sit under it.
export function getNow() {
  const file = readFile('state/now.md');
  if (!file) return null;
  const parsed = sections(file.raw);
  return {
    updated: file.updated,
    filled: file.filled,
    path: file.path,
    sections: parsed.sections.map((s) => ({
      heading: s.heading,
      filled: s.filled,
      html: renderBody(s.body),
    })),
  };
}

const CONFIG_PATH = 'profile.yaml';

// ── Who this is for ────────────────────────────────────────────────────────

// The name, and the only place the app gets it.
//
// It started as frontmatter on about_me.md and moved to data/profile.yaml when
// there was a second reader: a file that is prose for her, carrying one line
// that is not, is a file where the machine-readable part gets edited away by
// someone tidying the prose.
//
// It lives in the record because it is hers, not the harness's: HAR-02 puts
// everything personal in data/ and nothing personal outside it, and a name
// hard-coded into a component is exactly the leak that rule exists to stop. The
// app shipped with the name written into three files.
//
// The shape is validated in one place, .claude/hooks/lib/profile-schema.mjs, so the build gate and
// this reader cannot disagree about what a valid value is.
//
// Returns null when nothing is recorded, which is the state on first contact —
// the caller decides what to say to someone who has not told us their name yet.
// It does not invent one.
// The record's one structured file, parsed and cached on mtime like the rest.
//
// Separate from readFile() rather than a flag on it: that one is built for
// markdown — frontmatter, comment stripping, section splitting, an emptiness
// heuristic — and none of it means anything here. A YAML file that went through
// it would be silently mangled by the parts that assume prose.
//
// A parse error returns null rather than throwing. check-profile.mjs --all is
// what refuses to ship a broken file; a page that has one anyway should fall
// back, not 500.
// An old flat profile, shaped like the new one so the one validator reads both:
// a plain answer counts as answered, and a marker or a blank as not.
function legacyAsSections(flat) {
  const out = { mandatory: {}, recommended: {}, optional: {} };
  for (const [q, spec] of Object.entries(QUESTIONS)) {
    const v = typeof flat[q] === 'string' ? flat[q].trim() : '';
    const answered = v && !/^(declined|asked \d|removed \d)/i.test(v);
    out[spec.section][q] = answered
      ? { value: v, status: 'answered', status_reason: '', last_updated: '2000-01-01T00:00:00Z' }
      : { value: '', status: 'not_asked', status_reason: '', last_updated: '' };
  }
  return out;
}

function readConfig() {
  const path = join(activeDir(), CONFIG_PATH);
  if (!existsSync(path)) return null;

  // A different key on the same path from readFile's, which is the whole reason
  // fromFile takes one: a shared cache keyed on the path alone would let a
  // markdown parse answer a request for settings, or the other way round.
  return fromFile(path, 'record-yaml', () => {
    // The same strict parser the checks and hooks use, so what the page reads is
    // what they validated. A profile still in the old flat shape reads as js-yaml
    // parses it, until the next session start migrates it.
    const text = readFileSync(path, 'utf8');
    if (isLegacyProfile(text)) {
      try {
        const flat = parseYaml(text);
        return flat && typeof flat === 'object' ? legacyAsSections(flat) : null;
      } catch {
        return null;
      }
    }
    return parseProfile(text).data;
  });
}

// The validated settings, whole. getIdentity() is the name half of this, kept
// separate because three callers want only that.
export function getSettings() {
  const { value } = validateRecordConfig(readConfig());
  return { ...value, path: CONFIG_PATH };
}

// The anchor every dated label in the app measures from. One function, so a page
// and the data behind it cannot disagree about what day it is.
export function getToday() {
  return todayIn(getSettings().timezone);
}

export function getIdentity() {
  const meta = readConfig();
  // Errors are the build gate's business, not a page's. A typo in the config
  // should not take the record offline — check-profile.mjs --all refuses to
  // ship one, and if one gets through anyway the key reads as absent and the
  // wordmark falls back rather than the route throwing.
  const { value } = validateRecordConfig(meta);
  return { name: value.name, path: CONFIG_PATH };
}

// The pronouns every sentence in the app that refers to the person is built
// from. Absent from the config, this is "they" — see lib/pronouns.js for why
// that is the right answer rather than a fallback.
export function getPronouns() {
  const { value } = validateRecordConfig(readConfig());
  return pronouns(value.pronouns);
}

// ── Timeline ────────────────────────────────────────────────────────────────

// The spine. Two tiers, as the record keeps it: Eras to orient, entries for the
// range you need.
//
// Entries are returned newest first, which is the opposite of how the file stores
// them. The file is oldest-first because it is appended to; a reader arriving at
// the view wants the most recent thing at the top. Both are right for their own
// medium.
export function getTimeline() {
  const file = readFile('timeline.md');
  if (!file) return { eras: null, entries: [], tags: [], types: [], filled: false };

  const parsed = sections(file.raw);
  const find = (name) =>
    parsed.sections.find((s) => s.heading.toLowerCase().startsWith(name));

  const eras = find('eras');
  const rows = table(file.raw, 'Entries', parsed);

  const entries = rows
    .map((row) => {
      const date = /(\d{4}-\d{2}-\d{2})/.exec(row.date ?? '')?.[1] ?? null;
      return {
        date,
        year: yearOf(date),
        // "(told YYYY-MM-DD)" marks a gap between when something happened and
        // when she said it. Surfaced rather than swallowed: it is the difference
        // between a record of an event and a record of a disclosure.
        told: /\(told\s+(\d{4}-\d{2}-\d{2})\)/.exec(row.date ?? '')?.[1] ?? null,
        type: row.type ?? '',
        tags: (row.tags ?? '')
          .split(/[·,]/)
          .map((t) => t.trim().replace(/^`|`$/g, ''))
          .filter(Boolean),
        what: row.what_happened ?? '',
        // Her words are the record; a reading of them is not. The record marks
        // the difference with [inferred], and so does this.
        inferred: /\[inferred\]/i.test(row.what_happened ?? ''),
        file: (row.file ?? '').replace(/^`|`$/g, '').replace(/^→\s*/, '') || null,
      };
    })
    .filter((e) => e.date || e.what)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  // The controlled tag list at the top of the file, so a filter offers the tags
  // the record actually uses rather than inventing a vocabulary beside it.
  const declared = (find('tags in use')?.body ?? '')
    .split('\n')
    .filter((l) => l.includes('`'))
    .flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1]));

  const used = [...new Set(entries.flatMap((e) => e.tags))];
  const tags = [...new Set([...declared, ...used])].sort();

  return {
    eras: eras?.filled ? renderBody(eras.body) : null,
    entries,
    tags,
    types: [...new Set(entries.map((e) => e.type).filter(Boolean))].sort(),
    filled: entries.length > 0,
    path: file.path,
  };
}

// ── Calendar ────────────────────────────────────────────────────────────────

// What is coming, and the dates that land hard every year.
//
// The hard anniversaries are the reason this is read on the home view rather than
// only on its own tab. CLAUDE.md asks the agent to know when it is inside a
// fortnight of one and be gentler without announcing it; a surface that only
// showed them on a tab she has to think to open would be no help with that.
export function getCalendar(now = getToday()) {
  const file = readFile('calendar/calendar.md');
  if (!file) return { upcoming: [], passed: [], hard: [], good: [], nearHard: [], filled: false };

  const parsed = sections(file.raw);
  const dated = table(file.raw, 'Coming up', parsed)
    .map((row) => ({
      date: /(\d{4}-\d{2}-\d{2})/.exec(row.date ?? '')?.[1] ?? row.date ?? '',
      what: row.what ?? '',
      notes: row.notes ?? '',
    }))
    .filter((r) => r.what)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Split on today, rather than showing the whole table under "Coming up".
  //
  // calendar/calendar.md says an entry moves to the timeline once it has passed, but that
  // happens in a session, and sessions do not run on the day a thing happens. So
  // between an appointment and the next conversation the row is still sitting in
  // the file — and it was being rendered under "Coming up", on the home view,
  // labelled "3 days ago". A surface that tells her an appointment she has
  // already been to is still ahead of her is worse than one that says nothing.
  //
  // Passed rows are kept and shown, not hidden: the record does not delete, and
  // "did that happen?" is a real question. They just stop being the future.
  const isPast = (r) => {
    const away = daysAway(r.date, now);
    return away != null && away < 0;
  };

  const upcoming = dated.filter((r) => !isPast(r));
  const passed = dated.filter(isPast).reverse();

  const recurring = (heading) =>
    table(file.raw, heading, parsed)
      .map((row) => {
        const when = row.date_dd_mon ?? row.date ?? '';
        const days = daysUntilRecurring(when, now);
        return {
          when,
          what: row.what ?? '',
          handling: row.how_she_wants_it_handled ?? row.how_it_s_handled ?? '',
          daysAway: days,
          // A fortnight, matching the window CLAUDE.md names. The view uses it to
          // decide what to carry, never to put a countdown in front of her.
          near: days != null && days <= 14,
        };
      })
      .filter((r) => r.what);

  const hard = recurring('Recurring — the hard');
  const good = recurring('Recurring — the good');

  return {
    upcoming,
    passed,
    hard,
    good,
    // Anything hard inside the fortnight. Read by the home view, which changes
    // its own tone rather than saying anything about it.
    nearHard: hard.filter((h) => h.near),
    filled: dated.length > 0 || hard.length > 0 || good.length > 0,
    path: file.path,
  };
}

// ── People ──────────────────────────────────────────────────────────────────

// One file per person. She never re-explains who someone is, and this is the view
// that makes that visible to her too.
// The one contact line a person's file may carry. Returned null unless it is
// something a phone could actually dial — a label like "through the practice" is
// true and useful and is not a number, and the safety view must never render it
// as one.
function phoneOf(lead) {
  const raw = /\*\*Phone:\*\*\s*(.+)/.exec(lead ?? '')?.[1]?.trim();
  if (!raw) return null;
  const number = raw.replace(/[()–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^\+?[\d ]+$/.test(number)) return null;
  return number.replace(/\D/g, '').length >= 3 ? number : null;
}

export function getPeople() {
  return listDir('people')
    .map((name) => {
      const slug = name.replace(/\.md$/, '');
      const doc = render(`people/${name}`);
      if (!doc) return null;
      const parsed = sections(doc.raw);
      return {
        slug,
        name: doc.title ?? slug,
        // "**Who they are to me:**" from the template's lead, which is the one
        // line a list of people actually needs.
        relation:
          /\*\*Who they are to me:\*\*\s*(.+)/.exec(parsed.lead)?.[1]?.trim() ?? null,
        // "**Phone:**", also from the lead, and optional everywhere it is read.
        //
        // It exists for one page. SAF-011 says the most concrete help available
        // is offered rather than the most comforting, and that a person in the
        // room beats anything this can do — and her safety plan names the people
        // she would call without carrying a single number to call them on. The
        // number is a standing fact about a person, so it lives in the person's
        // file and the safety plan points at it, rather than being copied into
        // the plan where it would be a second ledger to keep in step.
        //
        // Digits, spaces and a leading + only, so what reaches a tel: href is
        // dialable. Anything else parses as absent, which renders as no dial row
        // rather than as a row that looks tappable and is not.
        phone: phoneOf(parsed.lead),
        filled: doc.filled,
        html: doc.html,
        path: doc.path,
      };
    })
    .filter(Boolean);
}

export function getPerson(slug) {
  return getPeople().find((p) => p.slug === slug) ?? null;
}

// Every timeline line that mentions someone by their first name.
//
// The match is on the name appearing in the line. Crude, and deliberately so: a
// tagging scheme she would have to maintain is a filing job, and she never
// files. A missed line costs a link; a wrong one costs a glance.
//
// It lives here rather than in the person view because the rail beside that view
// has to know whether the section exists before it can link to it, and a rail
// that re-implements the match is a rail that will one day link to an anchor the
// page did not render.
export function getMentions(name) {
  if (!name) return [];
  const first = name.split(/\s+/)[0];
  if (!first) return [];
  const re = new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return getTimeline().entries.filter((e) => re.test(e.what));
}

// ── Journal ─────────────────────────────────────────────────────────────────

// Dated entries, newest first. No count is returned and none is displayed: see
// the note at the top of lib/dates.js.
export function getJournal() {
  return listDir('journal')
    .map((name) => {
      const doc = render(`journal/${name}`);
      if (!doc) return null;
      const date = /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? doc.updated ?? null;
      return {
        slug: name.replace(/\.md$/, ''),
        date,
        year: yearOf(date),
        title: doc.title,
        html: doc.html,
        filled: doc.filled,
        path: doc.path,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}

// ── The person ──────────────────────────────────────────────────────────────

// The standing files. Ordered as a reader meets them, not alphabetically: who
// they are, then what they are working toward, then the two files about how to
// be useful to them, then the patterns they have named themselves.
//
// `caution` marks the two files CLAUDE.md says to read BEFORE writing anything.
// They are not more important than the others; they are the ones where getting it
// wrong costs the person something, so the view says so.
//
// The blurbs are built from the configured pronouns rather than written out,
// because they are sentences ABOUT the person and there is no wording that is
// both natural and true for every record. `p` is the set from lib/pronouns.js
// and `v` conjugates to match it — "they have" and "she has" come out of the
// same template.
const meFiles = (p, v) => [
  {
    file: 'about_me.md',
    label: 'About me',
    blurb: `The basics, so ${p.subject} never ${v('introduce')} ${p.reflexive} twice.`,
  },
  {
    file: 'what_i_want.md',
    label: 'What I want',
    blurb: `What ${p.subject} ${v('be')} working toward.`,
  },
  {
    file: 'what_helps.md',
    label: 'What helps',
    blurb: `What has actually worked for ${p.object}. Outranks anything general.`,
    caution: true,
  },
  {
    file: 'how_to_talk_to_me.md',
    label: 'How to talk to me',
    blurb: `${caps(p.possessive)} words, what lands badly, what not to push on.`,
    caution: true,
  },
  {
    file: 'patterns.md',
    label: 'Patterns',
    blurb: `Loops ${p.subject} ${v('have')} named ${p.reflexive}. Nothing here was assigned to ${p.object}.`,
  },
];

export function getMe() {
  const p = getPronouns();
  return meFiles(p, (verb) => agree(p, verb)).map((entry) => {
    const doc = render(`me/${entry.file}`);
    return {
      ...entry,
      slug: entry.file.replace(/\.md$/, ''),
      filled: doc?.filled ?? false,
      // Section by section rather than as one blob, so the view can show only
      // what is written and leave out the empty headings and the file's own note
      // to itself about what belongs under them. Reading "Keep it short — this is
      // the headline" back to the person would be showing them the scaffolding.
      sections: doc ? renderSections(doc.raw) : [],
      updated: doc?.updated ?? null,
      path: doc?.path ?? `me/${entry.file}`,
    };
  });
}

// A file's `##` sections, each rendered and each knowing whether anything is in
// it. The shape several views need, in one place.
function renderSections(raw) {
  return sections(raw).sections.map((s) => ({
    heading: s.heading,
    filled: s.filled,
    html: renderBody(s.body),
  }));
}

// ── Therapy ─────────────────────────────────────────────────────────────────

export function getTherapy() {
  const focus = render('therapy/what_im_working_on.md');
  const appointments = listDir('therapy/sessions')
    .map((name) => {
      const doc = render(`therapy/sessions/${name}`);
      if (!doc) return null;
      const date = /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? doc.updated ?? null;
      return { slug: name.replace(/\.md$/, ''), date, title: doc.title, html: doc.html, path: doc.path };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  return {
    focus: focus ? { ...focus, sections: renderSections(focus.raw) } : null,
    appointments,
  };
}

// ── Open loops ──────────────────────────────────────────────────────────────

// Threads to come back to, and the things she meant to say to her therapist and
// has not. The second group is the one that earns this a place on the home view:
// it is written verbatim, ready for the next appointment, and it is useless if it
// is only found by someone who went looking.
export function getOpenLoops() {
  const file = readFile('state/open_loops.md');
  if (!file) return { groups: [], open: 0, filled: false };

  const groups = sections(file.raw).sections.map((s) => ({
    heading: s.heading,
    items: s.body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^-\s*\[[ xX]\]/.test(l))
      .map((l) => ({
        done: /^-\s*\[[xX]\]/.test(l),
        text: l.replace(/^-\s*\[[ xX]\]\s*/, '').trim(),
      }))
      .filter((i) => i.text),
    // Anything that is not a checkbox — prose she or the agent left under the
    // heading. Kept, because dropping it would silently lose part of the record.
    html: renderBody(s.body.split('\n').filter((l) => !/^\s*-\s*\[[ xX]\]/.test(l)).join('\n')),
  }));

  const open = groups.flatMap((g) => g.items).filter((i) => !i.done).length;
  return { groups, open, filled: open > 0, path: file.path };
}

// ── Safety plan ─────────────────────────────────────────────────────────────

// Always present, always reachable, and deliberately parsed rather than dumped:
// the numbers at the top have to be findable in a state where reading is hard, so
// the view lifts them out of the prose and gives them their own block.
// Her reasons and what helps her on her own, first; everything else in the
// order the file keeps it. Stable within each group, so the plan's own ordering
// survives everywhere it is not overridden.
const LIFTED = /(reasons|help me, on my own|things that help)/i;

function rank(list) {
  return [
    ...list.filter((s) => s.filled && LIFTED.test(s.heading)),
    ...list.filter((s) => !(s.filled && LIFTED.test(s.heading))),
  ];
}

// Everyone her record knows about who is named in this piece of the plan.
//
// SAF-011: "a person in the room beats everything the system can do", and the
// draft-the-message offer is "the highest-value action available here and the
// easiest to skip in favour of saying something warm". A tap that dials the
// person her plan already told her to call is the same argument, one step
// earlier — and it is the one thing on this page that does something rather than
// saying something.
//
// People without a number on file come back too, rather than being filtered out.
// Their row is then a way into their file instead of a way to ring them, which
// is worth having on its own: her plan says "Orla — Sundays, or any time if it
// is bad" and everything else she knows about Orla is one click away rather than
// in a tab she has to go and find.
//
// ── Why the roster is built once and handed in ──────────────────────────────
//
// This ran getPeople() itself, which read well and cost a great deal: a plan has
// six or seven sections and every one of them would have swept the whole people
// directory again. render() is cached on mtime, so the disk read and the file's
// own markdown pass were free — but sections() and renderSections() underneath
// getPeople() are not cached, so each sweep re-parsed and re-rendered every
// person's file from scratch. Six sections over four people came to something
// like a hundred and twenty markdown passes to answer a question about names,
// on a page whose whole argument is that it opens fast in the worst state.
//
// The same trade the comment above render() describes, missed one level up.
function roster() {
  return (
    getPeople()
      // A person with no name to match on would compile to /\b\b/, which matches
      // every section and would put them on all of them. Guarded here rather
      // than at the call site, so one place decides who is matchable.
      .filter((person) => person.name?.split(/\s+/)[0])
      .map((person) => ({
        person: {
          slug: person.slug,
          name: person.name,
          phone: person.phone,
          relation: person.relation,
        },
        // Compiled once per person rather than once per person per section, for
        // the same reason.
        named: new RegExp(
          `\\b${person.name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        ),
      }))
  );
}

function namedIn(body, people) {
  const text = String(body ?? '');
  return people.filter((entry) => entry.named.test(text)).map((entry) => entry.person);
}

export function getSafetyPlan() {
  const file = readFile('safety/safety_plan.md');
  if (!file) return null;

  const parsed = sections(file.raw);
  const urgent = parsed.sections.find((s) => s.heading.toLowerCase().includes('right now'));

  // Parsed by lib/safety.mjs, which scripts/check-safety.mjs runs on the same
  // input. See SAF-002: a check that re-implements the parse is not a check.
  const contacts = parseCrisisContacts(file.raw);

  // Once for the whole plan. See roster() for what this used to cost per section.
  const people = roster();

  return {
    contacts,
    // The urgent section as written, rendered. The view falls back to this if
    // `contacts` ever comes back empty, so a reformatted plan degrades to "her
    // own words, unparsed" rather than to an empty box where the numbers were.
    urgentHtml: urgent?.body ? renderBody(urgent.body) : null,
    // The rest of the plan, minus the urgent block the view renders itself, in
    // the order it is READ rather than the order it is written.
    //
    // Her reasons and what helps her on her own are lifted to the front, because
    // CLAUDE.md asks that those two -- written on a better day -- be what she
    // meets first. The ordering lives here rather than in the view so the rail
    // beside it lists the sections in the order the page actually renders them.
    sections: rank(parsed.sections.filter((s) => s !== urgent)).map((s) => ({
      heading: s.heading,
      filled: s.filled,
      html: renderBody(s.body),
      // The people this section names, each with a number if one is on file.
      //
      // Matched on her own words rather than on the heading, which is what keeps
      // this from depending on a plan being laid out the way the sample is. Her
      // plan happens to gather the people under "People I can reach" and "My
      // care team"; another plan might name someone under "Things that help me"
      // and mean it just as much, and this follows the text either way.
      //
      // Same crude first-name match getMentions() uses, and for the same reason:
      // a tagging scheme she would have to maintain is a filing job, and she
      // never files. A missed name costs a row; a wrong one costs a row pointing
      // at the wrong person, so the match is on a whole word only.
      people: namedIn(s.body, people),
    })),
    // Everything above the first `##`, which is the file's own `# Safety plan`
    // title AND the line under it saying who built the plan and when. Only the
    // second is wanted here: the view supplies the title itself, and rendering
    // the lead whole printed "Safety plan" a second time as a heading in the
    // middle of the page, under the crisis numbers. dropLeadingH1 is the helper
    // that exists for exactly this — see the note above it in lib/markdown.js.
    lead: dropLeadingH1(renderBody(parsed.lead)),
    // The plan is meant to be built with a clinician. Until something is in it,
    // the view says so instead of pretending there is a plan.
    filled: parsed.sections.filter((s) => s !== urgent).some((s) => s.filled),
    path: file.path,
  };
}

// ── The record itself ───────────────────────────────────────────────────────

export function getIndex() {
  return render('INDEX.md');
}

// One line per session. Read only for the date of the most recent one, which is
// the single honest answer to "when was this record last added to" — and which
// the home view shows as a date, never as a gap.
export function getLastSession() {
  const file = readFile('state/log.md');
  if (!file) return null;
  const dates = [...file.raw.matchAll(/(\d{4}-\d{2}-\d{2})\s*·/g)].map((m) => m[1]).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

// ── Nav counts ──────────────────────────────────────────────────────────────

// What the rail shows beside a view's name.
//
// Only two things are counted, and both are counts of THINGS ON FILE, never of
// her behaviour: how many people have a file, and how many threads are open. No
// journal count, no session count, no streak. The rule is at the top of
// theme/palette.mjs and it is enforced here, not just described there.
export function getNavCounts() {
  const counts = {};
  // A readdir, not getPeople(): the count needs the files, not every one of
  // them rendered, and this runs from the layout on every page.
  const people = listDir('people').length;
  if (people > 0) counts['/people'] = { value: people };
  const loops = getOpenLoops().open;
  if (loops > 0) counts['/loops'] = { value: loops };
  return counts;
}

// ── Home ────────────────────────────────────────────────────────────────────

// Everything the home view needs, read in the order CLAUDE.md prescribes for a
// session: now, then the timeline, then what those point at. The view is the
// same read a session does, rendered.
//
// Dated from getToday(), in her timezone, like every other view. A bare
// new Date() is UTC, and for hours a day split "Coming up" differently from
// /calendar.
export function getHome(now = getToday()) {
  const timeline = getTimeline();
  const calendar = getCalendar(now);
  const people = getPeople();

  return {
    now: getNow(),
    lastSession: getLastSession(),
    recent: timeline.entries.slice(0, 6),
    timelineFilled: timeline.filled,
    calendar,
    loops: getOpenLoops(),
    people,
    // The focus file alone: home shows nothing else from therapy, and
    // getTherapy() would render every session to get it.
    focus: render('therapy/what_im_working_on.md'),
    // True until anything real is on file. The whole surface changes shape in
    // that state rather than showing eight empty panels, which would read as a
    // system that is broken instead of a record that has not started.
    blank:
      !timeline.filled &&
      !calendar.filled &&
      people.length === 0 &&
      listDir('journal').length === 0,
  };
}
