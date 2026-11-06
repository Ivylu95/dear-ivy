import { Empty, Enter, PageHead, SectionHead, Source, Tag, dateLabel, untilLabel } from '@/components/ui';
import { getCalendar, getToday } from '@/lib/content';

export const dynamic = 'force-dynamic';

// What is coming, and the dates that land hard every year.
//
// ── Why the hard anniversaries are shown the way they are ───────────────────
//
// CLAUDE.md asks the agent to know when it is inside a fortnight of one, be
// gentler, and NOT announce it. That instruction is about a conversation, and it
// does not transfer unchanged to a page she opened on purpose: a date she chose
// to look up should not be hidden from her.
//
// So the compromise is that this view SHOWS them and does not COUNT DOWN to
// them. A date and how she wants it handled, in the same quiet type as every
// other row — never "6 days away" in amber, which would turn a page she can
// close into a thing that follows her around. The fortnight window is computed
// in lib/content.js and used by the agent; nothing on this page renders it.
export default async function Calendar() {
  const { upcoming, passed, hard, good, filled } = await getCalendar();
  const today = await getToday();

  if (!filled) {
    return (
      <Enter>
        <PageHead
          route="/calendar"
          title="Calendar"
          sub="What's coming, and the dates that land hard."
        />
        <Empty title="Nothing on the calendar yet">
          Appointments, deadlines, trips and birthdays land here as they come up.
        </Empty>
        <Source path="data/calendar/calendar.md" />
      </Enter>
    );
  }

  return (
    <Enter>
      <PageHead
        route="/calendar"
        title="Calendar"
        sub="What's coming, and the dates that land hard."
      />

      <SectionHead title="Coming up" />
      {upcoming.length === 0 ? (
        <Empty title="Nothing coming up">Anything with a date lands here first.</Empty>
      ) : (
        upcoming.map((item) => (
          <div key={`${item.date}-${item.what}`} className="row">
            <div className="row-head">
              <span className="row-title">{item.what}</span>
              <span className="row-meta">{untilLabel(item.date, today)}</span>
            </div>
            <div className="meta-line">
              <span>{dateLabel(item.date)}</span>
              {item.notes && <span>{item.notes}</span>}
            </div>
          </div>
        ))
      )}

      {/* Already happened, still in the file. An entry moves to the timeline
          during a session, and sessions do not run on the day a thing happens, so
          this gap is normal rather than a lapse — and the rows are shown rather
          than hidden, because "did I actually go?" is a real question. */}
      {passed.length > 0 && (
        <>
          <SectionHead title="Just gone" note="not yet moved to the timeline" />
          {passed.map((item) => (
            <div key={`${item.date}-${item.what}`} className="row is-past">
              <div className="row-head">
                <span className="row-title">{item.what}</span>
                <span className="row-meta">{untilLabel(item.date, today)}</span>
              </div>
              <div className="meta-line">
                <span>{dateLabel(item.date)}</span>
                {item.notes && <span>{item.notes}</span>}
              </div>
            </div>
          ))}
        </>
      )}

      {hard.length > 0 && (
        <>
          <SectionHead title="Every year — the hard ones" />
          {hard.map((item) => (
            <div key={`${item.when}-${item.what}`} className="row">
              <div className="row-head">
                <span className="row-title">{item.what}</span>
                <span className="row-meta">{item.when}</span>
              </div>
              {item.handling && (
                <div className="meta-line">
                  <span>{item.handling}</span>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {good.length > 0 && (
        <>
          <SectionHead title="Every year — the good ones" />
          {good.map((item) => (
            <div key={`${item.when}-${item.what}`} className="row">
              <div className="row-head">
                <span className="row-title">{item.what}</span>
                <span className="row-meta">{item.when}</span>
              </div>
              <div className="tags">
                <Tag kind="ok">worth remembering warmly</Tag>
              </div>
            </div>
          ))}
        </>
      )}

      <Source path="data/calendar/calendar.md" />
    </Enter>
  );
}
