import { ReviewActions } from '@/components/review/ReviewActions';
import { RailNav } from '@/components/shell/RailNav';
import { Tag } from '@/components/ui';
import { findEntry } from '@/lib/review';

export const dynamic = 'force-dynamic';

// The actions column: what can be done about the entry that is open.
//
// ── Why the rail holds a control, when it holds none anywhere else ──────────
//
// Everywhere else in this app the right rail is a contents list, because
// everywhere else there is nothing to do — the record is read, not answered.
// This view is the exception the whole tab exists for: an entry in
// `.claude/REVIEW.md` is a question waiting on a person, and the answer is
// the point of the page rather than a footnote to it.
//
// So the three columns say the three things in the order they are asked. Left:
// what is on the list, and where each of them got to. Middle: what this one
// says. Right: what to do about it. The verdict used to sit under the finding,
// which put it below the fold on every long entry — the entries most in need of
// a decision were the ones whose controls were hardest to find.
//
// ── What sits under it ──────────────────────────────────────────────────────
//
// Where you are, and the way through. The panel's own buttons move you on when
// a verdict is filed; these move you on when one is not, which is most entries
// on a first pass. Next rolls over into the following list at the end of one and
// Previous does not: Next is going forward through work, Back is undoing a step,
// and a Back that landed in a different list would be a step somewhere new
// wearing the wrong word.

// Accepted reads as settled, rejected as closed, reopened as neither. The tones
// are the ones the rest of the app already uses.
const TONE = { Accepted: 'ok', Rejected: 'quiet', Reopened: 'warn' };

export default async function ReviewEntryRail({ params }) {
  const { id } = await params;
  const { kind, list, entry, position, prev, next } = findEntry(id);
  if (kind === 'missing') return null;

  const isDecided = kind === 'decided';

  const items = [
    prev && { href: prev, label: '← Previous' },
    next && { href: next, label: 'Next →' },
  ].filter(Boolean);

  return (
    <>
      {/* The verdict already given, above the control that would reverse it.
          Without it, a decided entry offers a Reopen button with nothing on
          screen saying what is being reopened from. */}
      {isDecided && (
        <section className="rail-card review-rail-verdict">
          <Tag kind={TONE[entry.verdict] ?? 'quiet'}>{entry.verdict}</Tag>
          <span className="review-when">{entry.when}</span>
          {entry.why && <p className="review-why">{entry.why}</p>}
        </section>
      )}

      <ReviewActions id={entry.id} decided={isDecided} next={next} />

      {/* The title carries the position, because that is the fact this block
          exists for and a row saying "3 of 16" would be a row you cannot
          click. */}
      <RailNav title={`${list} · ${position.at} of ${position.of}`} items={items} />
    </>
  );
}
