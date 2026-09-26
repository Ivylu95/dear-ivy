'use client';

import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';

// The five stages of a session, and the line back.
//
// ── Why this one is interactive when nothing else here is ───────────────────
//
// The view has one job: say what happens to what she says, in a glance. That
// puts a hard ceiling on how many words a card can carry — and the things it had
// to leave out are exactly the ones a sceptical reader wants ("saves WHERE?",
// "reads WHAT first?"). Prose cannot hold both; a card that opens can.
//
// So the caption is what you read at a glance, and the sentence behind it is
// there for the reader who stops. Nothing is hidden that changes the meaning of
// what is shown — opening a card adds detail, it never corrects the summary.
//
// ── The card grows; the row does not ────────────────────────────────────────
//
// What you see is the card getting taller, exactly the way a tile does under
// "Where it lands": same tint, same hairline, same sentence below it, one
// continuous card. What actually happens is that the lower half is positioned
// out of the layout, so the row it belongs to cannot feel it.
//
// That split is the whole design, and it is there because three honest versions
// each broke something:
//
//   Grown in flow, alone — the row is as tall as its tallest card, so the
//   return line dropped to the bottom of the open one and its arrow pointed up
//   into empty space instead of into stage one.
//
//   Grown in flow, five sharing a height — the line stayed welded on, and
//   clicking one card visibly inflated the other four.
//
//   Moved out to one panel under the whole figure — nothing moved and nothing
//   inflated, but the answer appeared a long way from the card it belonged to
//   and had to announce which of the five it was for.
//
//   Hung off the card as a floating dropdown, with a notch and a shadow — the
//   right mechanics and the wrong object: this page is paper, and one element
//   lifting off it read as a menu rather than as part of the drawing.
//
// So: the mechanics of the fourth, the appearance of the first. The row is
// frozen, the other four cards never move, and the sentence is attached to the
// card that was asked. The only cost is that an open card covers the return
// line beneath it, and closing it gives that back exactly as it was.
//
// ── What the lighting is for ────────────────────────────────────────────────
//
// Pointing at a stage lights the joins BEFORE it: the path the thing you said
// has travelled to get there. It is the one piece of motion on the page and it
// is entirely under the reader's hand — nothing moves on its own, nothing
// pulses, nothing counts. Rule 3 in theme/palette.mjs is the boundary and this
// stays well inside it.
//
// The return line lights from either end, because it has two and both are real:
// the last stage is where it leaves, the first is where its arrow arrives.
//
// ── Why the state is here and not in CSS ────────────────────────────────────
//
// A `:has(~ .wf-stage:hover)` rule would light the joins with no JavaScript, and
// was the first attempt. It cannot answer for the OPEN card, though — that is
// state, not a pointer position — so the row would have had two sources of truth
// for one highlight and they would have disagreed the moment a card was opened
// with the mouse elsewhere. One owner, in the component that already needs to be
// a client component for the disclosure.
const STAGES = [
  {
    title: 'You talk',
    line: 'Nothing to file, name or approve.',
    detail:
      'No forms, no fields. If this record ever needs something from you to keep working, that is a fault in how it was built.',
  },
  {
    title: 'It reads first',
    line: 'Now, then the timeline, then what they point at.',
    detail:
      'The same order every session: the snapshot, the dated events, then the files those point at. It is why nobody is explained twice.',
  },
  {
    // Two words, like the three beside it. It was "It writes as you go", which
    // is the better sentence and the worse card: at a fifth of the row it
    // wrapped to a second line, and one stage standing taller than the other
    // four reads as one stage mattering more than them. The caption under it
    // carries the "as you go" now, where there is room for it.
    title: 'It writes',
    line: 'Written down as you talk, without asking.',
    detail:
      'An event, a person, a date, something that helped — written while you are still talking, not at the end of it.',
  },
  {
    // Trimmed when the surface went to one face: Newsreader sets wider than the
    // sans did, and 'It saves at once' stopped fitting the fifth of a row it
    // has. A wrapped title makes its card taller than the four beside it, which
    // reads as that stage mattering more. The caption carries 'at once'.
    title: 'It saves',
    line: 'Committed and pushed within the minute.',
    detail:
      'Straight away: a conversation may not get an end. The message names the file it touched, never what was in it.',
  },
  {
    // Same trim, same reason. 'here' is what the caption under it says.
    title: 'You read it',
    line: 'Every page in this app is that folder.',
    detail:
      'It renders those same files and only ever reads them. Nothing you click in here writes a word to your record.',
  },
];

export function Loop() {
  const base = useId();
  const [open, setOpen] = useState(null);
  const [at, setAt] = useState(null);
  const lit = at ?? open;

  const figureRef = useRef(null);
  const flowRef = useRef(null);
  const firstRef = useRef(null);
  const facesRef = useRef([]);

  // How much taller the row is than its first card: the gap the return line's
  // left riser has to climb to reach the bottom edge of "You talk".
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    const flow = flowRef.current;
    const first = firstRef.current;
    if (!flow || !first) return undefined;

    const measure = () => {
      setExtra(Math.max(0, Math.round(flow.offsetHeight - first.offsetHeight)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(flow);
    observer.observe(first);
    return () => observer.disconnect();
  }, []);

  const close = useCallback((restoreFocus) => {
    setOpen((current) => {
      if (current != null && restoreFocus) facesRef.current[current]?.focus();
      return null;
    });
  }, []);

  // Escape closes the open card and puts focus back on it.
  //
  // No click-outside listener. That belongs to something floating over the page
  // — a menu, a dropdown — where leaving it open would cover the thing you turned
  // to look at. This is part of a card in the document: it covers nothing, and
  // closing it because a click happened elsewhere would be the page tidying up
  // after a reader who had not asked it to.
  useEffect(() => {
    if (open == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <figure className="wf wf-figure" ref={figureRef} style={{ '--wf-extra': `${extra}px` }}>
      <ol className="wf-flow" ref={flowRef}>
        {STAGES.map((stage, i) => {
          const id = `${base}-${i}`;
          const isOpen = open === i;
          return (
            <Fragment key={stage.title}>
              {/* The join between two stages: a drawn path, never an arrow
                  CHARACTER (DES-003). Lit when the stage after it has been
                  reached. aria-hidden because the list is already ordered —
                  a screen reader says "3 of 5", which is what this means. */}
              {i > 0 && (
                <Icon
                  name="chevron"
                  size={16}
                  className="wf-join"
                  data-lit={lit != null && lit >= i ? 'true' : undefined}
                  aria-hidden="true"
                />
              )}
              <li
                className="wf-stage"
                data-open={isOpen ? 'true' : undefined}
                ref={i === 0 ? firstRef : undefined}
              >
                <button
                  type="button"
                  className="wf-stage-face"
                  ref={(el) => {
                    facesRef.current[i] = el;
                  }}
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setOpen(isOpen ? null : i)}
                  onPointerEnter={() => setAt(i)}
                  onPointerLeave={() => setAt(null)}
                  // Keyboard focus lights the path; a click does not leave it
                  // lit. A mouse click focuses the button too, so a plain
                  // onFocus kept the joins burning after the pointer had gone —
                  // the same stuck-highlight the stylesheet fixes with
                  // :focus-visible, and this is that test asked in JavaScript,
                  // by the same browser, for the same reason.
                  onFocus={(e) => {
                    if (e.target.matches(':focus-visible')) setAt(i);
                  }}
                  onBlur={() => setAt(null)}
                >
                  <span className="wf-stage-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="wf-stage-title">{stage.title}</span>
                  <span className="wf-stage-line">{stage.line}</span>
                  {/* The affordance. A mark rather than the word "more": it
                      turns to point down when the card is open, which says both
                      that there is something here and which way it went. */}
                  <Icon name="chevron" size={14} className="wf-stage-mark" aria-hidden="true" />
                </button>
                {/* The lower half of the card, in the card and in the flow.
                    Closed with a grid row at 0fr rather than with display:none,
                    which is what lets the height animate at all; `visibility:
                    hidden` rides along to keep the text out of the
                    accessibility tree while it is shut. */}
                <div
                  className="wf-stage-more"
                  id={id}
                  data-open={isOpen ? 'true' : undefined}
                  role="region"
                  aria-label={stage.title}
                >
                  <p>{stage.detail}</p>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>

      {/* The return. Without it this is a pipeline with an end, which is the
          opposite of what the record does.

          It lights at EITHER end, because it has two and both are real: the
          last stage is where the line leaves, the first is where it arrives,
          and its arrowhead has been pointing into stage one the whole time. Lit
          only from stage five, the card the arrow actually touches was the one
          card that could not light it — so the reader who started at the
          beginning, which is everyone, saw a dead line with a live arrow on it. */}
      <div
        className="wf-return"
        data-lit={lit === 0 || lit === STAGES.length - 1 ? 'true' : undefined}
        aria-hidden="true"
      >
        <Icon name="chevron" size={16} className="wf-return-arrow" />
      </div>
      <figcaption className="wf-return-label">
        The next conversation starts from what this one wrote
      </figcaption>
    </figure>
  );
}
