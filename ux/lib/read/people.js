// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the people reader. Nothing here writes.

import { join } from 'node:path';
import { activeDir } from '@/lib/data-dir';
import { sections } from '@/lib/markdown';
import { readPeople } from '../../../.claude/hooks/lib/people.mjs';
import { CORE_DATA } from '../../../.claude/hooks/lib/modules.mjs';
import { nameMatcher } from '@/lib/name-match.mjs';
import { core, derive, render } from '@/lib/read/source';
import { getTimeline } from '@/lib/read/timeline';

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

// A person is a page, people/<name>.md, or a folder whose README.md is the front
// page (FND-004). The reader is shared with the privacy checks, so nobody is
// listed here and missed there.
export const peopleOnFile = () => readPeople(join(activeDir(), CORE_DATA, 'people')).people;

export function getPeople() {
  return peopleOnFile()
    .map(({ slug, file }) => {
      const doc = render(core(`people/${file}`));
      if (!doc) return null;
      return derive(doc, `person::${slug}`, () => person(slug, doc));
    })
    .filter(Boolean);
}

// One person's entry, from their rendered file. Built once per version of it.
export function person(slug, doc) {
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
  const re = nameMatcher(name);
  if (!re) return [];
  return getTimeline().entries.filter((e) => re.test(e.what));
}
