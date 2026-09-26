import Link from 'next/link';
import { Lands } from '@/components/workflow/Lands';
import { Loop } from '@/components/workflow/Loop';
import { Enter, PageHead, SectionHead } from '@/components/ui';
import { Icon } from '@/components/ui/icons';

// How a conversation becomes a record — drawn rather than described.
//
// ── Why it is worth a tab ───────────────────────────────────────────────────
//
// Every other page in this app is the OUTPUT of a process — a timeline, a
// person's file, a plan for a bad night — and nowhere did the process itself
// appear. That left the most consequential fact about this system unwritten on
// the surface: that nothing here is filed by hand, that a thing said in passing
// is written down within the minute, and that the writing is done by the
// conversation rather than by whoever is reading this.
//
// ── Why it is diagrams and not paragraphs ───────────────────────────────────
//
// It was paragraphs first, and paragraphs were the wrong form for the one
// question this page exists to answer. "What happens to what I say" is a shape —
// five stages, a return, and a fan-out into eight files — and a shape read as
// prose has to be held in the head a sentence at a time and assembled there. The
// reader who most needs this page is the one who wants to know in a glance
// whether her words are safe; asking her to read six hundred words to find out
// is answering a different question from the one she asked.
//
// So the text here is captions, and the caption is held to a line. Anything that
// wants a paragraph is a sign the diagram is wrong, not that the caption is too
// short.
//
// ── How the drawing is done ─────────────────────────────────────────────────
//
// Grid, borders and the app's own icon set. Nothing here is an image, an inline
// SVG diagram or a chart library, for three reasons that all matter more than
// the convenience would have: every word stays real text, so it can be found,
// selected and read aloud; every line and ground is a theme token, so the
// diagram follows the hue, the character and the mode like everything else
// (DES-004); and the arrows are paths from components/ui/icons.jsx rather than
// arrow CHARACTERS, so no part of it depends on a glyph the reader's font may
// not carry (DES-003).
//
// Two of the figures answer to a click, and both live under
// components/workflow/ because of it: Loop.jsx and Lands.jsx. Each opens the
// same way — the card grows, a sentence appears — because two kinds of
// expanding card on one page, behaving differently, would be two things to
// learn. Their own headers say what each interaction is for.
//
// What is left here is static and server-rendered: the layers, the three rules,
// and the two notes.
//
// ── What it is and is not ───────────────────────────────────────────────────
//
// A description, not a control panel: nothing here switches anything on. See
// About for what this app promises — that page is the contract, this one is the
// mechanism.
//
// It reads nothing. Every other view opens a file under `data/` and renders it;
// this one is fixed, so it holds no record and cannot leak one. That is also why
// there is no `dynamic` export below: there is nothing here to go stale.

// The three layers of instruction behind a conversation, in order of how
// reliably they fire. The tag is load-bearing: it says whether a layer can miss,
// and the top one is the answer to "what happens if everything else does".
const LAYERS = [
  {
    when: 'always',
    name: 'The instruction file',
    what: 'Safety, privacy, and what gets written down. Read at the start of every session.',
  },
  {
    when: 'on match',
    name: 'Session shapes',
    what: 'An appointment just had, a person, a good day, a loop you keep hitting.',
  },
  {
    when: 'unprompted',
    name: 'Checks',
    what: 'Fire at the start of a session, before a write, and after one.',
  },
];

// What holds whatever else changes. Three, because three is what fits on one
// line of tiles and because these are the three the rest of the app promises.
const RULES = [
  { icon: 'speech', title: 'You never file', what: 'No forms, no tags, nothing to tidy.' },
  { icon: 'layers', title: 'Nothing is deleted', what: 'Superseded things are archived, not removed.' },
  { icon: 'monitor', title: 'This window only reads', what: 'No page here writes to your record.' },
];

export default function Workflow() {
  return (
    <Enter>
      <PageHead
        route="/workflow"
        title="Workflow"
        sub="You talk. It reads, writes and saves. This window reads it back."
      />

      <SectionHead title="The loop" note="one conversation, start to finish" />
      <Loop />

      <SectionHead title="Where it lands" note="said once, kept in one place" />
      <Lands />

      <SectionHead title="What shapes it" note="none of it decided in the moment" />
      <div className="wf-layers">
        {LAYERS.map((layer) => (
          <div key={layer.name} className="wf-layer" data-when={layer.when}>
            {/* The tag says when the layer fires, in words. The bar down the
                left says the same thing in weight, and neither is alone in
                saying it — a diagram that encodes its one important
                distinction in colour alone is a diagram for some readers. */}
            <span className="wf-when">{layer.when}</span>
            <span className="wf-layer-name">{layer.name}</span>
            <span className="wf-layer-what">{layer.what}</span>
          </div>
        ))}
      </div>
      <p className="note">
        All of it is on <Link href="/harness">Harness</Link>, what changed in it is
        on <Link href="/changes">Changes</Link>, and what the agent has argued
        should change — and may not change itself — waits on{' '}
        <Link href="/review">Review</Link>.
      </p>

      <SectionHead title="What always holds" />
      <div className="wf-tiles wf-tiles-rules">
        {RULES.map((rule) => (
          <div key={rule.title} className="wf-tile wf-tile-static">
            <span className="wf-tile-well">
              <Icon name={rule.icon} size={17} className="wf-tile-icon" />
            </span>
            <span className="wf-tile-name">{rule.title}</span>
            <span className="wf-tile-what">{rule.what}</span>
          </div>
        ))}
      </div>
      {/* Two sentences, and both of them are limits rather than features. They
          are prose because a limit stated as a tile reads as a boast. */}
      <p className="note">
        It gets things wrong. Say so, and it is fixed in the open — a new dated
        line saying what changed, the old one archived. And it is not a clinician:
        where it and your care team disagree, your care team is right.
      </p>
    </Enter>
  );
}
