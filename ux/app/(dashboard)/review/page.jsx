import Link from 'next/link';
import { Banner, Empty, Enter, PageHead, Prose } from '@/components/ui';
import { getReview } from '@/lib/review';

export const dynamic = 'force-dynamic';

// Review: everything the agent raised about the specs and may not act on.
//
// This is the panel with nothing open — the file's own preamble, and what is in
// each of its three lists. The entries themselves are one route deeper, beside
// the queue that opens them.
//
// ── Why it is a tab ─────────────────────────────────────────────────────────
//
// `specs/` is locked against the agent. Where it finds a row that looks
// wrong, or a place the repository has drifted from one, it is forbidden to fix
// either — it writes the finding to `.claude/REVIEW.md` and leaves it. That
// file says what it is in its first line: "Written by the agent; cleared by a
// person."
//
// The writing half has worked since the first session. The clearing half had no
// surface at all, so the queue only ever grew — thirty entries, several of them
// superseding each other, none marked as settled, and the only way to clear one
// was to open a markdown table in an editor and delete a row. A human approval
// gate that nobody can reach is not a gate; it is a backlog.
//
// ── What it is not ──────────────────────────────────────────────────────────
//
// It is not an editor of the specs, and accepting an item changes nothing in
// `specs/`. A verdict here is a decision recorded against a finding; the
// edit it authorises is still a deliberate change to a committed file, with a
// commit message. The distance between those two is the gate, and this view
// shortens the queue rather than removing it.
//
// It also never touches her record. lib/review.js resolves one path through the
// harness resolver, at module load, and no request can name another.
export default function Review() {
  const { ok, intro, queues, decided, open } = getReview();

  return (
    <Enter>
      <PageHead
        route="/review"
        title="Review"
        sub={
          open === 0
            ? 'Nothing is waiting on a decision.'
            : `${open} ${open === 1 ? 'thing is' : 'things are'} waiting on a decision.`
        }
      />

      {!ok && (
        <Banner tone="warn">
          The review queue could not be read. If this app cannot find{' '}
          <code>.claude/REVIEW.md</code> or <code>specs/REVIEW.md</code>,
          it is running against a checkout that has no harness in it, and nothing
          on this page describes the agent you are actually talking to.
        </Banner>
      )}

      {/* The file's own preamble, rendered rather than restated. It is the thing
          that says what a deviation is and what a proposal is, it is kept in step
          by whoever edits the file, and a second copy written into this component
          would be a second copy to keep in step. */}
      {ok && intro && <Prose html={intro} className="review-intro" />}

      {/* What is in each list, as a sentence rather than a second copy of the
          queue. The column beside this already lists every entry; repeating them
          here would be two lists of the same thing on one screen, and the reader
          would have to work out which of the two to click. */}
      {ok && (
        <div className="review-tally">
          {[
            ...queues.map((queue) => ({
              key: queue.key,
              label: queue.heading,
              blurb: queue.blurb,
              n: queue.items.length,
              first: queue.items[0],
            })),
            {
              key: 'decided',
              label: 'Decided',
              blurb:
                'Cleared, and kept. Appended to rather than rewritten — a decision can be reopened, and the reversal is recorded rather than the decision erased.',
              n: decided.length,
              first: decided[0],
            },
          ].map((group) => (
            <section className="review-tally-group" key={group.key}>
              <h2 className="review-tally-head">
                {group.label}
                <span className="review-tally-n">{group.n}</span>
              </h2>
              <p className="review-tally-blurb">{group.blurb}</p>
              {group.first ? (
                <p className="review-tally-first">
                  <Link href={group.first.href}>
                    {group.key === 'decided' ? 'Most recent' : 'Start here'} —{' '}
                    {group.first.ids.join(' · ')}
                  </Link>
                </p>
              ) : (
                <p className="review-tally-first dim">Nothing here.</p>
              )}
            </section>
          ))}
        </div>
      )}

      {ok && (
        <p className="review-where">
          Cleared here, written back to the queue the entry came from —{' '}
          <Link href="/harness/REVIEW.md">
            <code>.claude/REVIEW.md</code>
          </Link>{' '}
          for the repository,{' '}
          <Link href="/specs/REVIEW.md">
            <code>specs/REVIEW.md</code>
          </Link>{' '}
          for the specs — and committed like any other change; see{' '}
          <Link href="/changes">Changes</Link>.
        </p>
      )}

      {ok && open === 0 && decided.length === 0 && (
        <Empty title="Nothing raised yet">
          What the agent notices about the specs but is not allowed to act on —
          where the repository has drifted from a rule, and where a rule may
          itself be wrong.
        </Empty>
      )}

    </Enter>
  );
}
