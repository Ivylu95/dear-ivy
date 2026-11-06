import Link from 'next/link';
import { Card, Empty, Enter, PageHead, Prose, SectionHead, Source, dateLabel, untilLabel } from '@/components/ui';
import { Row } from '@/components/ui/Row';
import { TimelineEntry } from '@/components/ui/TimelineEntry';
import { getHome, getPronouns, getToday } from '@/lib/content';
import { moduleOn } from '@/lib/modules';
import { agree } from '@/lib/pronouns';
import { slugify } from '@/lib/views';

export const dynamic = 'force-dynamic';

// The home view is the same read a session does, rendered: now.md first, then the
// timeline, then what those point at. Anything else would be a second opinion
// about what matters, and the record already has one.
//
// What is deliberately NOT here: any count of her. No entries this month, no
// sessions held, no days since the last one. The reasoning is at the bottom of
// components/ui/index.jsx and it is the single firmest rule in this app.
export default async function Home() {
  const { now, recent, timelineFilled, calendar, loops, people, focus, blank, lastSession } =
    await getHome();
  const p = await getPronouns();

  // Before anything real is on file, the surface changes shape rather than
  // showing eight empty panels. Eight empty panels read as a broken system; one
  // sentence reads as a record that has not started, which is the truth.
  if (blank) {
    return (
      <Enter>
        <PageHead
          route="/"
          title="Nothing yet"
          sub="Fills itself in as you talk. Nothing to file."
        />
        <Empty title="The record starts from the next conversation">
          Whatever you say gets written down where it belongs — what happened, who
          it involved, what helped. This page is where you come back to read it.
        </Empty>
        {now?.filled && (
          <>
            <SectionHead title="Where things stand" note={now.updated ? dateLabel(now.updated) : null} />
            {now.sections
              .filter((s) => s.filled)
              .map((s) => (
                <Card key={s.heading} as="section" id={slugify(s.heading)} title={s.heading}>
                  <Prose html={s.html} />
                </Card>
              ))}
            <Source path="data/core/state/now.md" />
          </>
        )}
      </Enter>
    );
  }

  const upcoming = calendar.upcoming.slice(0, 4);
  const today = await getToday();
  const forTherapist = loops.groups.find((g) => /appointment/i.test(g.heading));

  return (
    <Enter>
      <PageHead
        route="/"
        title="Now"
        sub={
          lastSession
            ? `Where things stand, as of ${dateLabel(lastSession)}.`
            : 'Where things stand, before anything is written down.'
        }
      />

      {/* now.md, section by section rather than as one blob. "How she's doing" is
          the first heading in the file and carries the most, so it gets its own
          card at the top and the rest sit under it in the order the file keeps
          them. The file decides the order; this just renders it. */}
      {now?.filled ? (
        now.sections
          .filter((s) => s.filled)
          .map((s) => (
            <Card key={s.heading} as="section" id={slugify(s.heading)} title={s.heading}>
              <Prose html={s.html} />
            </Card>
          ))
      ) : now?.missing ? (
        <Empty title="The snapshot could not be read">
          The file this page reads it from is missing, so what is shown here may
          be incomplete.
        </Empty>
      ) : (
        <Empty title="No snapshot written yet">
          The current picture gets rewritten at the end of every conversation.
        </Empty>
      )}
      <Source path="data/core/state/now.md" />

      <SectionHead title="Lately" note={<Link href="/timeline">the whole timeline</Link>} />
      {timelineFilled ? (
        <div className="tl">
          {recent.map((entry) => (
            <TimelineEntry key={`${entry.date}-${entry.what}`} entry={entry} p={p} />
          ))}
        </div>
      ) : (
        <Empty title="No events on the timeline yet">
          Anything that happens gets one dated line here, pointing at wherever the
          detail lives.
        </Empty>
      )}
      <Source path="data/core/timeline.md" />

      {/* Coming up. After the timeline, as a session reads it (NOW-001): the
          snapshot, then the spine, then what those two point at. */}
      {upcoming.length > 0 && (
        <>
          <SectionHead title="Coming up" note={<Link href="/calendar">all dates</Link>} />
          {upcoming.map((item) => (
            <Row
              key={`${item.date}-${item.what}`}
              title={item.what}
              meta={untilLabel(item.date, today)}
              details={[dateLabel(item.date), item.notes]}
            />
          ))}
          <Source path="data/core/calendar/calendar.md" />
        </>
      )}

      {/* What she meant to say to her therapist and has not.

          This is on the home view and not only under Open loops for one reason:
          it is written verbatim, ready for the next appointment, and it is
          useless if it is only found by someone who went looking for it. */}
      {forTherapist && forTherapist.items.some((i) => !i.done) && (
        <>
          <SectionHead
            title="For the next appointment"
            note={<Link href="/loops">open loops</Link>}
          />
          <Card>
            <ul className="bullets">
              {forTherapist.items
                .filter((i) => !i.done)
                .map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
            </ul>
          </Card>
          <Source path="data/core/state/open_loops.md" />
        </>
      )}

      {moduleOn('therapy') && focus?.filled && (
        <>
          <SectionHead title={`What ${p.subject} ${agree(p, 'be')} working on`} note={<Link href="/therapy">therapy</Link>} />
          <Card>
            <Prose html={focus.html} />
          </Card>
          <Source path="data/therapy/what_im_working_on.md" />
        </>
      )}

      {people.length > 0 && (
        <>
          <SectionHead title="People" note={<Link href="/people">everyone on file</Link>} />
          <div className="grid-2">
            {people.slice(0, 6).map((person) => (
              <Row key={person.slug} href={`/people/${person.slug}`} title={person.name} details={[person.relation]} />
            ))}
          </div>
          <Source path="data/core/people/" />
        </>
      )}
    </Enter>
  );
}
