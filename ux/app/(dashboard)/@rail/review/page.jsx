import { RailNav } from '@/components/shell/RailNav';
import { getReview } from '@/lib/review';

export const dynamic = 'force-dynamic';

// The overview's rail: the three lists, with how many are in each.
//
// ── Why there is one at all, beside an index ────────────────────────────────
//
// The harness has both columns for a reason this view inherits: the left one
// lists the THINGS, the right one says where you are among them. They answer
// different questions and the index cannot answer the second — it is thirty rows
// long and scrolls, so what it shows depends on where it has been scrolled to.
//
// On this page it is the shape of the file in four lines: two queues, a log, and
// the counts. A reader arriving at Review wants to know how much is waiting
// before they want to know what the first of it says.
//
// It asks for the queue itself, because a parallel route cannot be handed
// anything by the page beside it. It does not read the file twice: lib/review.js
// caches its parse on the file's mtime, so the second ask in a render returns
// the first one's work.
export default function ReviewRail() {
  const { ok, queues, decided } = getReview();
  if (!ok) return null;

  // Hrefs rather than anchors. The sections on the overview are cards, not
  // headings with ids, and the useful destination from here is the first entry
  // of a list rather than the top of a card describing it — a rail row that
  // scrolls you 200px is a row that did nothing.
  const items = [
    ...queues.map((queue) => ({
      href: queue.items[0]?.href ?? '/review',
      label: queue.heading,
      meta: String(queue.items.length),
    })),
    {
      href: decided[0]?.href ?? '/review',
      label: 'Decided',
      meta: String(decided.length),
    },
  ];

  return <RailNav title="In the queue" items={items} />;
}
