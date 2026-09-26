import { HarnessPanel } from '@/components/harness/HarnessPanel';
import { ReviewIndex } from '@/components/review/ReviewIndex';
import { ReviewResizer } from '@/components/review/ReviewResizer';
import { getReview } from '@/lib/review';

export const dynamic = 'force-dynamic';

// Two columns inside the one the app already gives this view: the queue on the
// left, whatever is open on the right.
//
// ── Why a layout and not a component on each page ───────────────────────────
//
// Because Next keeps a layout's DOM across navigations between its children.
// Deciding an entry swaps the panel and leaves the queue alone — same scroll
// position, same filter still typed, no re-mount, no flash. Rendered per page it
// would be rebuilt on every verdict, which is the same pixels and a completely
// different feeling: a list that blinks each time you clear something from it
// reads as a new screen with a menu on it, not as a queue getting shorter.
//
// ── Why this view gets one, when only the harness had one ───────────────────
//
// The harness's own layout makes the argument: a master-and-detail column earns
// its width where the activity is moving through a series of things in one
// sitting, and nowhere else. Reading a spec, then the skill it governs, then the
// hook that enforces it is that activity. So is clearing a backlog — read one,
// decide it, read the next — and it is the only other place in this app where
// it happens.
//
// Nothing else here qualifies, and that is the line to hold. Every view over
// `data/` is one page about one thing, read on its own; giving the timeline an
// index would be a column of dates beside a list of dates.
//
// ── What it does not do ─────────────────────────────────────────────────────
//
// It does not read the file twice. lib/review.js caches its parse on the file's
// mtime, so this layout and the page inside it ask the same question and the
// second one is answered from the first one's work.
export default function ReviewLayout({ children }) {
  const { ok, queues, decided } = getReview();

  // The three lists the file actually has, flattened into what the column
  // draws. Built here rather than in the client component so the shape of the
  // queue stays a decision made where the queue is read.
  //
  // ── Five fields, not the whole entry ────────────────────────────────────────
  //
  // `rows` used to be `queue.items` as getReview() returns them, which is every
  // entry with its raw markdown AND its rendered HTML hanging off it. ReviewIndex
  // is a client component, so everything handed to it is serialised into the
  // payload beside the page — and it draws five fields per row. The rest was the
  // full text of thirty findings, shipped twice over, to render a list of
  // citations: 208 KB of HTML on a page whose own content is a four-line tally.
  //
  // The entry's body is not lost and was never wanted here. It belongs to the
  // panel this column opens, /review/[id], which reads it from the same cached
  // parse when a row is actually clicked.
  const forIndex = (rows) =>
    rows.map(({ id, href, verdict, ids, gist }) => ({ id, href, verdict, ids, gist }));

  const groups = ok
    ? [
        ...queues.map((queue) => ({
          key: queue.key,
          label: queue.heading,
          empty: 'nothing open',
          rows: forIndex(queue.items),
        })),
        {
          key: 'decided',
          label: 'Decided',
          empty: 'nothing cleared yet',
          rows: forIndex(decided),
        },
      ]
    : [];

  return (
    <div className="harness-split review-split">
      {/* Below the breakpoint the two columns stack and the queue folds itself
          away behind a button — a list and a document side by side on a phone is
          two things each too narrow to read. The fold lives inside ReviewIndex
          rather than around it, for the reason the harness gives: a <details>
          without `open` hides its contents at every width. */}
      <aside className="harness-aside">
        <ReviewIndex groups={groups} />
      </aside>

      {/* The seam sits between the two columns rather than inside either, so the
          grid gives it a track of its own and neither column has to reserve
          space for a control that belongs to both. */}
      <ReviewResizer />

      {/* The harness's panel wrapper, used as it is rather than copied. All it
          does is start the outgoing content fading on the click, before the
          server has finished reading the incoming one — which is a fact about
          having a panel at all, not a fact about the harness. A second component
          doing the same thing under a different name is the duplication
          DES-001 is about. */}
      <HarnessPanel>{children}</HarnessPanel>
    </div>
  );
}
