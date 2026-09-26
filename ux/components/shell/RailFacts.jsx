'use client';

import { useId } from 'react';
import { RailHead, useRailFold } from '@/components/shell/RailFold';

// A block of stated facts in the right rail: label on the left, value on the
// right, one per row.
//
// ── Why the rail and not the page head ──────────────────────────────────────
//
// These are the things that are true ABOUT a file rather than part of it — what
// language it is, how many lines, which event a hook fires on. They were tags
// under the title, and three problems came with that.
//
// They pushed the document down. A tag row is a band of chrome between the name
// of the thing and the thing itself, and on a source view the thing itself is
// the point — you arrive wanting line 40, and a header telling you the file is
// JavaScript is standing in the way of it.
//
// They stacked. The page head lays its children out in a column, so two tags
// were two rows, and "javascript" over "175 lines" reads as a list of two
// unrelated announcements rather than as a set of properties.
//
// And they were in the wrong column. This app already has a place for "what is
// true of the thing you are looking at, that is not the thing itself" — the
// right rail, which is where the contents list lives for exactly the same
// reason. A fact about the file and a way into the file are the same kind of
// thing: margin.
//
// ── Why it is not RailNav with the links taken out ──────────────────────────
//
// Because a row here goes nowhere, and RailNav's rows all do. It carries a
// scroll-spy, a click-pinning ref and a "back to top" control, all of which
// exist to answer "where am I in this document" — a question a language name
// does not participate in. Sharing the component would mean a list that looks
// navigable and is not, which is the one thing a rail must never be.
//
// It borrows the CLASSES, though: .rail-card and .rail-head are the shapes the
// column is built out of, and a block here that framed itself differently would
// read as something pasted into the margin rather than as part of it.
export function RailFacts({ title, rows }) {
  const folded = useRailFold('facts');
  const id = useId();
  const shown = (rows ?? []).filter((row) => row && row.value != null && row.value !== '');
  if (!shown.length) return null;

  return (
    <section className="rail-card">
      {/* The heading is the fold; nothing else is on this row. RailNav's head
          puts "Top" beside its own, and the two line up because both are built
          out of .rail-head either way. */}
      <RailHead name="facts" title={title} bodyId={id} />

      {/* A description list, because that is what this is: each row is a term
          and its value, and saying so in the markup is what lets a screen reader
          read the pair as a pair rather than as two loose strings. */}
      {!folded && (
        <dl className="rail-facts" id={id}>
          {shown.map((row) => (
            <div key={row.label} className="rail-fact">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
