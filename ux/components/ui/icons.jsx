import { MARK_PATHS, MARK_STROKE, MARK_VIEWBOX } from '@/theme/mark.mjs';

// Inline SVG icon set.
//
// Deliberately not an icon library. An icon package would add a dependency and a
// runtime for what is, here, a few dozen fixed paths. These are plain SVG, tree-shaken
// to nothing the app does not use, and render identically on the server so there
// is no icon pop on hydration.
//
// All paths are drawn on a 24x24 grid with a 1.75 stroke and inherit currentColor.

const PATHS = {
  // ── Views ────────────────────────────────────────────────────────────────
  // A lit lamp. Now is the snapshot you read first, and the rest of the set is
  // made of documents and containers, so the one view that is about the present
  // moment takes the one glyph that is about light rather than paper.
  now: 'M9 18h6m-5 3h4M12 2a7 7 0 0 0-4 12.8V17h8v-2.2A7 7 0 0 0 12 2Z',
  // Three dated rows: a short mark for the date, a longer one for what happened,
  // stacked in order. Which is what `data/timeline.md` literally looks like.
  //
  // It was a vertical spine with events hung off it — true to the file, and it
  // did not survive being small. At 16px, the size the rail actually uses, the
  // spine and its three dots clotted into a solid edge with strokes coming off
  // one side, which reads as a pennant — beside `flag`, an actual pennant, two
  // rows below it. Two flags in one rail is worse than a plain list.
  //
  // Rings on a horizontal axis were tried first and fail the same way for the
  // same reason: at this size a 2px ring fills in, so three of them on a line
  // read as an ellipsis, which already means "more" everywhere else.
  timeline: 'M4 6h4m4 0h8M4 12h4m4 0h8M4 18h4m4 0h8',
  people: 'M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.9M16 3.6a4 4 0 0 1 0 7.7',
  calendar: 'M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm0 4h18M8 3v4m8-4v4',
  // An open book. The journal is the one place with no structure asked of it, so
  // it gets the glyph that means reading rather than filing.
  journal: 'M12 6.5C10.5 5 8.5 4.3 4 4.3V18c4.5 0 6.5.7 8 2.2 1.5-1.5 3.5-2.2 8-2.2V4.3c-4.5 0-6.5.7-8 2.2Zm0 0V20',
  // A portrait bust in a frame: the standing files about who she is.
  me: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm8 7.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM7.5 17.4a4.7 4.7 0 0 1 9 0',
  // Two speech bubbles, one answering the other. Not a couch and not a
  // clipboard, for the reason the chairs were chosen for and kept: the
  // appointment is a conversation between two people, and the record of it is
  // hers.
  //
  // It WAS two chairs facing, and the drawing did not survive the size. At 16px
  // the two uprights and the seat of each chair resolve to a vertical, a
  // crossbar and a foot — which is the letter A, twice, over a rule. A glyph
  // that reads as text in a list of labels is worse than no glyph. Bubbles keep
  // the same claim about what the hour is and still read as two of something at
  // a third of the size.
  therapy:
    'M2 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6l-4 3V5Zm20 6v4a2 2 0 0 1-2 2h-3l-3 3v-3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2Z',
  // A loose thread. Open loops are threads to come back to, and the glyph says
  // unfinished rather than overdue, which is the difference this view lives on.
  loops: 'M4 6h10a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h3M18 20l2-2-2-2',
  // A hand cupping. The safety plan is the one view drawn as holding rather than
  // as a document or a warning: a shield reads as defence against something, and
  // what this holds is her.
  safety: 'M12 21s7-3.6 7-9V6.2a1 1 0 0 0-.7-1L12 3 5.7 5.2a1 1 0 0 0-.7 1V12c0 5.4 7 9 7 9Zm-2.6-9.3 1.9 1.9 3.8-4',
  about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4v-5m0-4v.01',
  // A clock with its hand turned back, for the Changes tab: what the system did,
  // in the order it did it. Chosen by the owner over git's node-on-a-line, which
  // said "commit" to a developer and nothing to anyone else. The cost, weighed
  // and accepted: the old glyph's job was to keep this view apart from the
  // timeline's horizontal spine two rows above it — hers in order, the
  // repository's in order — and a clock says "the past" about both. The
  // rewinding arrow is what still points it at the system's history.
  history: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  // Two boxes and the arrow between them: a process, drawn the way a process has
  // been drawn on paper for a century. The obvious alternative was a cycle, and
  // it would have been wrong twice — `loops` already carries a line that comes
  // back on itself, and what this view describes does not come back on itself:
  // a thing is said, written down, saved, and read here.
  workflow:
    'M4 4h5v5H4V4Zm11 11h5v5h-5v-5ZM6.5 9v6.5a2 2 0 0 0 2 2H15m0 0-2.5-2.5M15 17.5l-2.5 2.5',

  // ── Chrome ───────────────────────────────────────────────────────────────
  // The bottom ray reaches 19..21, matching the top ray's 3..5 and the two
  // horizontal ones. It used to run 21..23 — two units further out than its
  // opposite number — which put the glyph's bounding box at 3..23 and its visual
  // centre a full unit below the grid's. Every other mark in this set is centred
  // on the grid, so the sun alone sat low wherever it was aligned with anything,
  // and beside a word in the appearance control that is exactly where it shows.
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-14v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  monitor: 'M3 4h18v12H3V4Zm5 16h8m-4-4v4',
  chevron: 'm9 6 6 6-6 6',
  // Sliders rather than a cog. A cog says "configuration"; these are three
  // preferences about how a page looks to read, and a row of adjustments is the
  // honest picture of that.
  // Braces around a centre line: the machinery that holds the record, drawn as
  // what holds rather than as what it is made of. A cog would have read as
  // settings, which is one folder in here rather than the whole of it — and the
  // set already spends its circular shapes on `sun`, `moon` and `about`.
  harness:
    'M9 3H8a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M15 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1M12 9v6',
  sliders: 'M4 6h10m4 0h2M4 12h2m4 0h10M4 18h10m4 0h2M14 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM6 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm8 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M6 6l12 12M18 6 6 18',
  // A glass. Drawn small and turned down-right like every other handle in the
  // set, and used only to mark the filter field in the harness index — a field
  // with a placeholder in it says what it is, and the mark is what finds it
  // again once something has been typed and the placeholder is gone.
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4',
  logout: 'M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4m7 14 5-5-5-5m5 5H10',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 16h2',
  // A handset lived here for the crisis block's own heading. That heading is an
  // ordinary section head now, like every other heading in the surface, and no
  // section head carries a glyph — so the path went with it rather than sitting
  // in this object unreferenced. This set is an object literal, not a module
  // graph: nothing tree-shakes an unused key out of it, and the only thing that
  // keeps it to what the app uses is deleting what the app stops using.
  // A quill. Marks the two files where getting it wrong costs her something, and
  // it means "read this before you write", which is what CLAUDE.md asks.
  quill: 'M4 20c6-10 10-13 16-16-1 7-3.5 12-9 14l-3 .5L4 20Zm4-1.5 5-5',
  // A leaf, for anything on file but not yet written in. Growing, not missing:
  // an empty file in this record is a thing that has not happened yet.
  leaf: 'M4 20c0-8 5.5-14 16-14 0 10-5.5 14-13 14H4Zm3-1c3-5 6-7.5 10-9',
  // ── The harness, entry by entry ─────────────────────────────────
  // One glyph per thing at the top of `.claude/`, chosen the way the view marks
  // above are: for what the thing IS, not for what kind of file it happens to
  // be. Ten folders and files all wearing the same folder icon is a list you
  // read by reading; ten marks that mean something is a list you can scan.
  //
  // They are a lookup with a fallback, never a requirement — anything added to
  // the harness that has no glyph here still appears, wearing the plain folder
  // or file below. See MARK in components/harness/HarnessList.jsx.

  // A prompt and a typed line. Commands are the one part of the harness a person
  // invokes on purpose, by name.
  terminal: 'm5 7 5 5-5 5M13 17h6',
  // A bolt. Hooks are the only rules here that do not wait to be read and
  // chosen — they fire at a fixed moment whether or not anyone remembers them.
  spark: 'M13 2 5 13h6l-2 9 8-11h-6l2-9Z',
  // A speech bubble, for the text sent on a schedule. What is in `prompts/` is
  // said to the agent by nobody who is awake to say it.
  speech: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6Z',
  // Sheets, stacked. One skill is one session shape, and the set of them is a
  // pile to be drawn from rather than a sequence to be followed.
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm9 11-9 5-9-5',
  // A plumb bob: the oldest instrument for "is this true?". The specs are the
  // rows the repository is checked against, not a description of it.
  plumb: 'M12 3v9m0 0 3.2 4.8a3.8 3.8 0 1 1-6.4 0L12 12Z',
  // An inbox tray, for the Review tab: things waiting for a person to deal with.
  // Chosen by the owner over the pennant it replaces, which was right about who
  // raises an item — the agent flags it — and silent about the part the tab is
  // for, which is a person clearing it.
  inbox: 'M3 13h5l1.5 3h5l1.5-3h5M5.5 5h13l2.5 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2.5-8Z',
  // The asterisk, for CLAUDE.md. It is the mark of the thing reading the file,
  // which is the one fact about it no glyph about DOCUMENTS can carry: every
  // other file in here is read by the agent, and this is the file that is the
  // agent's instructions.
  //
  // Eight spokes, with the diagonals a little short of the orthogonals so the
  // silhouette comes out round rather than square. The mark it is drawn after
  // has more, and more is what fails here: at 13px ten spokes close into a dark
  // disc at the centre and the glyph stops being a star at all.
  asterisk: 'M12 4v16M4 12h16M7.2 7.2l9.6 9.6M16.8 7.2 7.2 16.8',

  // ── The harness tree ──────────────────────────────────────────
  // The two most conventional glyphs in the set, and deliberately so. Everywhere
  // else here an icon is chosen to mean something about her record — a quill for
  // what to read first, a leaf for what has not happened yet. These two say only
  // "folder" and "file", because that is the whole question the harness tree has
  // to answer and a clever glyph would answer it worse than the obvious one.
  folder: 'M3 7a1 1 0 0 1 1-1h4.6a1 1 0 0 1 .7.3L11 8h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z',
  // A page with the corner turned, which is also how the corner is drawn: one
  // path for the sheet, one for the fold, so the fold reads as a fold rather
  // than as a notch cut out of the outline.
  file: 'M6 3h7.2L19 8.6V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7.2 0v5.6H19',

  // ── By what a file IS ─────────────────────────────────────────
  // Below the bespoke marks and above the plain page: a file with no glyph of
  // its own still says what KIND of thing it is. Nearly everything in `.claude/`
  // is markdown, so the plain page was doing no work on 39 of 42 files — it
  // marked "a file", which the reader could already see.

  // An M and a down arrow: markdown's own mark everywhere it has one, drawn
  // without its usual rounded box. The box is the half that does not survive
  // being rendered at 13px in a margin — at that size it closes the M in and
  // both go grey — and the zigzag-plus-arrow silhouette is the half that is
  // actually recognised.
  //
  // Both halves are set at the full height of the grid and nothing sits between
  // them. A glyph this small has room for two shapes and a gap, and the gap is
  // what keeps the pair from fusing into one dark smudge.
  markdown: 'M3 17V7l4.5 5.5L12 7v10M17.5 7v10m0 0 3-3.1m-3 3.1-3-3.1',
  // Brackets around three rows: a structured file, drawn as its shape rather
  // than as its syntax.
  //
  // `{ }` is the conventional mark and is not available here — `harness` is a
  // pair of braces, it heads this very column, and two brace glyphs six pixels
  // apart meaning different things is the one thing this set refuses. Square
  // brackets read as data just as plainly, and the rows between them survive
  // 12px where a brace's curl does not.
  brackets: 'M9.5 4H7a1.2 1.2 0 0 0-1.2 1.2v13.6A1.2 1.2 0 0 0 7 20h2.5M14.5 4H17a1.2 1.2 0 0 1 1.2 1.2v13.6A1.2 1.2 0 0 1 17 20h-2.5M10.6 9.6h2.8M10.6 14.4h2.8',
  // A pair of drafting dividers. ARCHITECTURE.md is the document the rest of the
  // harness is set out from, and the instrument for setting something out is the
  // oldest picture of that there is.
  //
  // Its neighbour `plumb` is the other drafting instrument in the set, for
  // `specs/` — the folder this file sits in. They are told apart by which end
  // carries the weight: the plumb bob hangs from a line, the dividers stand on
  // two legs from a hinge.
  //
  // The hinge is drawn large for the glyph — a fifth of its height — because a
  // correctly proportioned one disappears at this size and leaves a bare chevron
  // behind, which is the mark the tree already spends on folders.
  dividers: 'M12 2a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 0 1 12 2ZM10.7 6.9 5.2 20.6m8.1-13.7L18.8 20.6',
  // A charter scroll, for the Specs tab: standing rules, written down and
  // binding — what the harness is held to rather than one more document in it.
  // Chosen by the owner over a clipboard-and-tick, which read as "approved" as
  // much as "required". The dividers stay on ARCHITECTURE.md, the one document
  // the rest is set out from.
  spec: 'M8 6V5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v1h4Zm0 0v13a2 2 0 0 0 2 2M6 3h11a2 2 0 0 1 2 2v12M10 21h9a2 2 0 0 0 2-2v-2h-9v2a2 2 0 0 1-2 2ZM11 8h5M11 12h5',
};

/**
 * One glyph.
 *
 * `weight` is the stroke as it should ARRIVE on screen, in CSS pixels, and it is
 * the answer to the one way this set fails: the paths are drawn on a 24 grid, so
 * a stroke of 1.75 is 1.75 only at size 24 and scales with everything else on
 * the way down. At size 12 it lands at 0.875px — under a device pixel on an
 * ordinary display — and the browser answers a sub-pixel line by painting it
 * grey instead of dark. Every glyph in a small column goes soft at once, which
 * reads as a low-resolution icon set rather than as a thin one.
 *
 * So a caller that needs a small glyph asks for the weight it wants to SEE and
 * this divides back through the scale. Left off, the stroke is 1.75 on the grid
 * exactly as before, so nothing already placed moves.
 */
// The floor under a rendered stroke, in CSS pixels.
//
// A path here is drawn on a 24-unit grid, so a stroke given in those units is
// scaled with everything else: 1.75 units renders as 1.75 × size / 24 pixels —
// 1.17px at 16, but 0.73px at 10. Under a pixel a stroke stops being a thin
// line and becomes a grey one: the renderer has no pixel to put it in, so it
// spreads it across two at part strength. That is what made the smallest marks
// in the app — the tree's chevrons, the filter glass, the clear cross — look
// soft beside the bigger ones rather than smaller than them.
//
// 1.15 rather than a rounder number because it is not a new judgement: it is
// what the three call sites that hit this first had already reached for by
// hand, and they were reading the result on a real screen.
const MIN_STROKE = 1.15;

export function Icon({ name, size = 16, weight, className, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  // What the stroke should measure once drawn, then converted back into the
  // grid's units — the path is scaled by size / 24, so the value written here
  // has to be scaled by 24 / size to land on the asked-for width.
  //
  // A FLOOR, not a normalisation. Every icon at 16px and above already clears
  // it, so nothing about the marks anyone has already looked at changes; this
  // only stops the small ones falling under a pixel. Normalising them all to
  // one width was the other option and it would have thinned the 30px view mark
  // and the 38px crisis handset by a third, which is a judgement about those
  // two marks rather than a fix for a rendering fault.
  const stroke = weight ?? Math.max(MIN_STROKE, (1.75 * size) / 24);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={(stroke * 24) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

// The app's mark: a pen, and the line it has just written.
//
// It was an envelope — the wordmark is a salutation, so the mark was the letter.
// True, but generic: an envelope is the icon for mail everywhere else on her
// machine, and it said what the thing is CALLED rather than what it does.
//
// The pen says the thing itself. She talks and it gets written down for her;
// that is the whole product, and the stroke under the nib is the only part of
// it she ever sees.
//
// A feather quill was the obvious alternative and is the one to avoid: at 30px
// it reads as a leaf, and `leaf` is already the glyph this app uses for a file
// that is empty rather than missing. Two marks that look alike and mean
// opposite things is worse than a mark that is merely plain.
//
// Drawn once here and used in the rail and on the login card, so the two
// cannot drift.
export function BrandMark({ size = 32, className }) {
  const { x, y, w, h } = MARK_VIEWBOX;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${x} ${y} ${w} ${h}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={MARK_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {MARK_PATHS.map((path) => (
        <path
          key={path.d}
          d={path.d}
          strokeWidth={path.width ?? undefined}
          opacity={path.opacity ?? undefined}
        />
      ))}
    </svg>
  );
}
