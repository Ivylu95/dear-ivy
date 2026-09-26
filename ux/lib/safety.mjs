// The crisis numbers, parsed out of data/safety/safety_plan.md.
//
// ── Why this is its own file, and why it is .mjs ────────────────────────────
//
// SAF-002 in specs/interaction/safety.md: "One source of truth for the helpline
// numbers, referenced everywhere they appear. A startup check asserts their
// presence before the session begins." Its key consideration: "Duplicated
// numbers drift, and the copy that drifts is the one nobody reads until it
// matters. They have already been wrong once."
//
// The single source is the record. This file is the single PARSER of it, and it
// is dependency-free ESM so that two callers can run the identical function on
// the identical input:
//
//   the app     lib/content.js, rendering /safety
//   the check   scripts/check-safety.mjs, run by `npm run build`
//
// A check that re-implements the parse is not a check. It passes while the real
// parser fails, which is the failure it exists to catch.
//
// It takes the WHOLE file rather than a pre-extracted section, so the heading
// scan is part of what gets verified too — a renamed heading is exactly the kind
// of drift that would otherwise silently empty the block.

// The heading the numbers live under. Matched loosely on purpose: the section is
// "## If you need help right now", and a plan that says "right now" under any
// wording should still be found.
const URGENT = /right now/i;

export function urgentSection(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const out = [];
  let inside = false;

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      inside = URGENT.test(heading[1]);
      continue;
    }
    if (inside) out.push(line);
  }
  return out.join('\n').trim();
}

// Every "**Label: number**" chunk under that heading.
//
// A line can carry more than one, and the shortest number is three digits:
//
//   - **Samaritans of Singapore (SOS): 1767** — 24 hours
//   - **SOS CareText: 9151 1767** — WhatsApp, if talking is too much
//   - **national mindline: 1771** — 24 hours · **WhatsApp: 6669 1771**
//   - **Emergency: 995**
//
// One bold chunk is one row, NOT one line, because the third line holds two
// genuinely different ways to reach two different services and collapsing them
// loses one.
//
// The first version of this required five characters of digits and spaces and
// took only the first chunk per line. It silently dropped 1767 and 995 — the
// crisis line and the emergency number — and kept the two least urgent, with
// nothing anywhere reporting a problem. That is the exact failure SAF-002's key
// consideration describes, and it is why the check script exists.
export function parseCrisisContacts(markdown) {
  const lines = urgentSection(markdown)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'));

  return lines.flatMap((line) => {
    const chunks = [...line.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim());
    if (chunks.length === 0) return [];

    // "— 24 hours", "— WhatsApp, if talking is too much": the part of the line
    // that says which one to reach for. It belongs to the line, so it goes on
    // the line's first row only.
    const note = line
      .replace(/^-\s*/, '')
      .replace(/\*\*[^*]+\*\*/g, '')
      .replace(/^[\s—·,-]+/, '')
      .replace(/[\s—·,-]+$/, '')
      .trim();

    return chunks
      .map((chunk, i) => {
        // Split on the LAST colon: "Samaritans of Singapore (SOS): 1767" has a
        // label with its own punctuation in it.
        const at = chunk.lastIndexOf(':');
        if (at < 0) return null;
        const label = chunk.slice(0, at).trim();
        const number = chunk.slice(at + 1).trim();
        // Digits and spaces only, at least three digits. Anything else is a bold
        // phrase that is not a phone number.
        if (!/^[\d\s]+$/.test(number) || number.replace(/\D/g, '').length < 3) return null;
        return { label, number: number.replace(/\s+/g, ' '), note: i === 0 ? note : '' };
      })
      .filter(Boolean);
  });
}

// What the check asserts, named here so the app and the script agree on what
// "the numbers are present" means rather than each having an opinion.
//
// Four, because the plan carries four services — a crisis line, a text line, a
// second helpline and the emergency number — and a parse that finds one or two
// has usually half-broken rather than cleanly failed. Half-broken is the
// dangerous state: it renders a block that looks right and is missing the line
// she needed.
export const MINIMUM_CONTACTS = 4;

// Every phone number the harness SAYS, as opposed to the ones the record holds.
//
// ── Why there is a second parser here at all ────────────────────────────────
//
// SAF-002 asks for one source of truth for the helpline numbers, "referenced
// everywhere they appear", and the numbers appear in two genuinely different
// places for two genuinely different reasons:
//
//   data/safety/safety_plan.md   hers, rendered by /safety. Parsed above.
//   .claude/CLAUDE.md            the crisis script — what gets said out loud
//                                when she is not safe.
//
// The second one cannot be a pointer to the first. SAF-001 puts crisis handling
// in the always-loaded layer precisely so that it survives a missed dispatch,
// and a number that has to be looked up in a file is a number that is missing on
// the run that fails to look. So the duplication is deliberate and required.
//
// What was missing is the thing SAF-002 actually asks for: something that
// notices when the two stop agreeing. Change a number in her plan and the script
// keeps reciting the old one, silently, until the night it matters — which is
// the failure the spec describes in its own words, and which has happened once
// already.
//
// Bold spans only, and within them, digit runs that are not part of a word.
//
// Every number in the crisis script is emphasised, because it is meant to be
// found by eye in a block of prose — so bold is the honest signal for "this is
// a number to dial". The word guard is what keeps **SAF-012** from being read as
// a helpline; without it every bolded spec ID in the file is a phone number.
//
// What it still cannot tell apart is a bare bolded count — **300** rows would be
// read as a number. Nothing in CLAUDE.md is written that way today, and if
// something ever is, this fails loudly and says exactly which string it choked
// on rather than passing quietly. For a safety check that is the right way round.
export function spokenNumbers(markdown) {
  const out = new Set();
  for (const bold of String(markdown ?? '').matchAll(/\*\*([^*]+)\*\*/g)) {
    for (const run of bold[1].matchAll(/(?<![\w-])\d[\d\s]*\d(?![\w-])/g)) {
      const number = run[0].replace(/\s+/g, ' ').trim();
      if (number.replace(/\D/g, '').length >= 3) out.add(number);
    }
  }
  return out;
}
