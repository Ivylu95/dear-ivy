import Link from 'next/link';
import { Crumbs, Empty, Enter, PageHead, Prose } from '@/components/ui';
import { findEntry } from '@/lib/review';

export const dynamic = 'force-dynamic';

// One entry from the review queue, opened.
//
// The middle column: the citation, and the finding in full. Nothing on this
// page is anything but the file read back — the words are the agent's and are
// rendered as written, not summarised, because a verdict given on a paraphrase
// is a verdict on the wrong thing.
//
// The verdict itself is not here. It is the right rail — see
// app/(dashboard)/@rail/review/[id]/page.jsx — so that what can be done about
// an entry is in the same place on every entry, rather than below four hundred
// words of argument on the ones that most need deciding.
//
// ── Why the id is in the URL ────────────────────────────────────────────────
//
// So the queue can be a layout. Next keeps a layout's DOM across navigations
// between its children, which is what lets the list beside this hold its scroll
// position and its filter while entries open and close next to it — and that is
// only available if moving between entries is a navigation rather than a state
// change. The cost is the one handled below: an id is a hash of the row's text,
// so it stops resolving the moment the row is decided or edited.

export default async function ReviewItem({ params }) {
  const { id } = await params;
  const { kind, list, entry, position } = findEntry(id);

  // A link kept past the decision it was about, or an entry a session rewrote
  // while it was open. Not an error: the queue is a live file and this is the
  // ordinary way an address in it goes out of date, so it says so and points
  // back rather than reporting a fault.
  if (kind === 'missing') {
    return (
      <Enter>
        <PageHead route="/review" title="Not in the queue" />
        <Empty title="That entry is no longer there">
          An entry is identified by its own wording, so the address changes when
          the wording does — a decision, or a session rewriting the finding, and
          the link you followed names the version before it. The queue beside this
          is current; the whole of it, including what has been cleared, is in{' '}
          <Link href="/review">REVIEW.md</Link>.
        </Empty>
      </Enter>
    );
  }

  return (
    <Enter>
      <Crumbs
        items={[
          { href: '/review', label: 'Review' },
          { href: `/review/${id}`, label: list, current: true },
        ]}
      />

      {/* The citation is the title. It is what the entry is about, it is how
          `specs/README.md` asks that a row be referred to, and it is the only
          part of a finding short enough to be one. The finding itself is the
          body, below.

          A decided entry's verdict is deliberately NOT repeated here. It is in
          the rail, directly above the control that would reverse it, which is
          the one place it changes what a reader does. */}
      <PageHead
        route="/review"
        title={entry.ids.join(' · ')}
        sub={`${list} · ${position.at} of ${position.of}`}
      />

      {/* The finding, and nothing else. The verdict lives in the right rail —
          see app/(dashboard)/@rail/review/[id]/page.jsx. Under this it was
          below the fold on every long entry, so the answer to "what can I do
          here" depended on having read to the end. */}
      <Prose html={entry.html} className="review-said" />

    </Enter>
  );
}
