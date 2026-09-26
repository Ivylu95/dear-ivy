'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { VIEW_ICON, VIEW_LABEL } from '@/lib/views';

// Where a kind of thing lands, one tile per destination.
//
// ── Why a tile is not a link ────────────────────────────────────────────────
//
// It was one, and being one made the section answer a question nobody had
// asked. This page is read by somebody working out what happens to what they
// say; the tile that catches their eye is the one they are least sure about,
// and the old behaviour took that uncertainty and replied by emptying the page
// and opening a file. You lost the map at the exact moment you were reading it.
//
// So the tile discloses instead: one click, a sentence about what that file
// holds and when it is written, and you are still standing in the diagram. The
// link is still there, at the foot of what opens — going to the tab is now
// something you choose after reading rather than the only thing a click can do.
//
// The loop above answers a click with one panel under the whole figure; these
// answer in the tile itself, and the difference is not an inconsistency. The
// loop is a connected drawing — five cards, four joins and a line back — so a
// card that changes size moves the drawing and detaches the line. These eight
// are an independent grid with nothing drawn between them: one tile growing
// disturbs nothing, and keeping the sentence beside the name it belongs to
// beats sending the reader somewhere else on the page to find it.
//
// ── What the sentences are for ──────────────────────────────────────────────
//
// They answer "what would I find there", not "what is this feature". Each says
// what lands in the file and when it gets written — the two things that decide
// whether the record will have what she needs in a year. Nothing here restates
// the caption above it.
const LANDS = [
  {
    href: '/timeline',
    what: 'Something that happened',
    info: 'One line per event, oldest first, each pointing at the file that holds the detail. A session reads it second, straight after the snapshot — so anything here is something the next conversation already knows.',
  },
  {
    href: '/journal',
    what: 'A day, in your own words',
    info: 'Whole entries, dated, in your phrasing rather than a summary of it. For a day that wants writing down rather than reducing to a line.',
  },
  {
    href: '/people',
    what: 'Anyone you mention',
    info: 'One file per person: who they are to you, what has happened with them, and what you have said about them before. It is why you never introduce someone twice.',
  },
  {
    href: '/calendar',
    what: 'Dates ahead, and hard ones',
    info: 'Appointments, deadlines and birthdays, plus the dates that land hard every year. Being inside a fortnight of one changes how a session goes, without it being announced.',
  },
  {
    href: '/therapy',
    what: 'A session, and what came of it',
    info: 'How the appointment went, in your words, written down before it is discussed. Alongside it, what you and your clinician are currently working on.',
  },
  {
    href: '/loops',
    what: 'What you meant to say and did not',
    info: 'Kept word for word, ready for the next appointment. The thing you thought of on the way home is the thing this file exists for.',
  },
  {
    href: '/me',
    what: 'What helps, and how to speak to you',
    info: 'The standing facts: who you are, what has actually worked, what lands badly, and the patterns you have named yourself. Read before anything is written.',
  },
  {
    href: '/safety',
    what: 'Anything to do with being safe',
    info: 'Warning signs, what has helped on a bad night, and who to call. Anything safety-relevant is written here every time, with no exceptions and nothing waiting to be asked.',
  },
];

export function Lands() {
  const base = useId();
  const [open, setOpen] = useState(null);

  return (
    <div className="wf-tiles">
      {LANDS.map((land, i) => {
        const id = `${base}-${i}`;
        const isOpen = open === i;
        const label = VIEW_LABEL[land.href];
        return (
          <div
            key={land.href}
            className="wf-tile wf-tile-live"
            data-open={isOpen ? 'true' : undefined}
          >
            <button
              type="button"
              className="wf-tile-face"
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {/* The glyph sits in a tinted well rather than loose on the card.
                  Eight of them in a grid is the one place on this page where the
                  accent can carry a rhythm across the whole figure. */}
              <span className="wf-tile-well">
                <Icon name={VIEW_ICON[land.href]} size={17} className="wf-tile-icon" />
              </span>
              <span className="wf-tile-name">{label}</span>
              <span className="wf-tile-what">{land.what}</span>
              <Icon name="chevron" size={14} className="wf-tile-mark" aria-hidden="true" />
            </button>
            <div className="wf-tile-reveal" id={id} data-open={isOpen ? 'true' : undefined}>
              <div>
                <p>{land.info}</p>
                {/* The way to the tab, kept and moved. A destination worth
                    reading about is sometimes a destination worth opening, and
                    the difference now is that it takes a second, deliberate
                    click rather than being what the first one did to you.

                    tabIndex -1 while the panel is shut: the panel is
                    visibility:hidden, so it is already out of the tab order in
                    every browser that implements that correctly, and this is the
                    belt to that pair of braces. */}
                <Link
                  href={land.href}
                  className="wf-tile-go"
                  tabIndex={isOpen ? undefined : -1}
                >
                  Open {label}
                  <Icon name="chevron" size={13} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
