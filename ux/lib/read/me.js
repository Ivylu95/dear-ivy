// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the me reader. Nothing here writes.

import { renderBody, sections } from '@/lib/markdown';
import { agree, caps } from '@/lib/pronouns';
import { core, derive, listDir, render } from '@/lib/read/source';
import { getPronouns } from '@/lib/read/profile';

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
    const doc = render(core(`me/${entry.file}`));
    return {
      ...entry,
      slug: entry.file.replace(/\.md$/, ''),
      filled: doc?.filled ?? false,
      // Section by section rather than as one blob, so the view can show only
      // what is written and leave out the empty headings and the file's own note
      // to itself about what belongs under them. Reading "Keep it short — this is
      // the headline" back to the person would be showing them the scaffolding.
      sections: doc ? derive(doc, 'sections', (d) => renderSections(d.raw)) : [],
      updated: doc?.updated ?? null,
      path: doc?.path ?? `me/${entry.file}`,
    };
  });
}

// A file's `##` sections, each rendered and each knowing whether anything is in
// it. The shape several views need, in one place.
export function renderSections(raw) {
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
    focus: focus ? { ...focus, sections: derive(focus, 'sections', (d) => renderSections(d.raw)) } : null,
    appointments,
  };
}
