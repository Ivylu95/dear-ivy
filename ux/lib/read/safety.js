// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the safety reader. Nothing here writes.

import { dropLeadingH1, renderBody, sections } from '@/lib/markdown';
import { parseCrisisContacts } from '@/lib/safety.mjs';
import { firstName, nameMatcher } from '@/lib/name-match.mjs';
import { derive, readFile } from '@/lib/read/source';
import { getPeople } from '@/lib/read/people';

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
// is worth having on its own: her plan says "Person-O — Sundays, or any time if it
// is bad" and everything else she knows about Person-O is one click away rather than
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
// Each person is now built once per version of their file (derive(), above), so
// a sweep costs a readdir and a lookup; the roster stays built once regardless.
function roster() {
  return (
    getPeople()
      // A person with no name to match on would compile to an empty pattern,
      // which matches every section and would put them on all of them.
      // nameMatcher() returns null for them, and they are dropped here, so one
      // place decides who is matchable.
      .filter((person) => firstName(person.name))
      .map((person) => ({
        person: {
          slug: person.slug,
          name: person.name,
          phone: person.phone,
          relation: person.relation,
        },
        // Compiled once per person rather than once per person per section, for
        // the same reason.
        named: nameMatcher(person.name),
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

  // Once for the whole plan. See roster() for what this used to cost per section.
  // Matched on every call rather than cached with the plan: a person's file can
  // change while the plan does not, and the dial row must follow it.
  const people = roster();
  const plan = derive(file, 'safety', parseSafetyPlan);
  return {
    ...plan,
    // The people each section names, each with a number if one is on file.
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
    sections: plan.sections.map(({ body, ...section }) => ({ ...section, people: namedIn(body, people) })),
  };
}

// Everything in the plan that depends on its own file alone, built once per
// version of it.
function parseSafetyPlan(file) {
  const parsed = sections(file.raw);
  const urgent = parsed.sections.find((s) => s.heading.toLowerCase().includes('right now'));

  // Parsed by lib/safety.mjs, which scripts/check-safety.mjs runs on the same
  // input. See SAF-002: a check that re-implements the parse is not a check.
  const contacts = parseCrisisContacts(file.raw);

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
      body: s.body,
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
