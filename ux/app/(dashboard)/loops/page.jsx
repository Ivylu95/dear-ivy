import { Empty, Enter, PageHead, Prose, SectionHead, Source } from '@/components/ui';
import { getOpenLoops } from '@/lib/content';

export const dynamic = 'force-dynamic';

// Threads to come back to.
//
// The checkboxes are rendered as read-only marks, not as inputs, and that is the
// whole design of this page rather than a shortcut taken on the way to one.
//
// She never files. A checkbox she can tick is a filing job wearing a friendly
// hat: it makes the record something she has to maintain, and the moment she
// forgets to tick one the record is wrong and it is her fault. These get ticked
// in conversation, by the thing that put them there. This page shows what is
// outstanding; it does not ask her to do anything about it.
//
// The "Cold" group is kept and shown rather than hidden. Six months untouched is
// information — it is usually the thing that was too hard to say — and quietly
// dropping it from the view would be a small deletion of exactly the kind this
// record does not do.
export default async function Loops() {
  const { groups, open } = await getOpenLoops();
  const anything = groups.some((g) => g.items.length > 0);

  return (
    <Enter>
      <PageHead
        route="/loops"
        title="Open loops"
        sub="Threads left hanging. Nothing here needs doing."
      />

      {!anything ? (
        <Empty title="Nothing left hanging">
          Threads land here when a conversation runs out before they do.
        </Empty>
      ) : (
        groups.map((group) => {
          const outstanding = group.items.filter((i) => !i.done);
          const done = group.items.filter((i) => i.done);
          return (
            <section key={group.heading} className="view-section">
              <SectionHead
                title={group.heading}
                note={
                  group.items.length > 0
                    ? `${outstanding.length} open`
                    : undefined
                }
              />
              {group.items.length === 0 ? (
                <Prose html={group.html} />
              ) : (
                <div className="card">
                  <ul className="loop-list">
                    {[...outstanding, ...done].map((item) => (
                      <li key={item.text} data-done={item.done ? 'true' : undefined}>
                        <span aria-hidden="true" className="loop-mark">
                          {item.done ? '·' : '—'}
                        </span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })
      )}

      {open > 0 && (
        <p className="note">
          These get picked up in conversation. There is nothing to tick here.
        </p>
      )}
      <Source path="data/state/open_loops.md" />
    </Enter>
  );
}
