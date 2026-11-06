import { Banner, Empty, Enter, PageHead, Prose, SectionHead, Source, dateLabel } from '@/components/ui';
import { getOpenLoops, getTherapy } from '@/lib/content';

export const dynamic = 'force-dynamic';

// The current clinical focus, the appointments on file, and the things she meant
// to raise and has not.
//
// The banner at the top is not decoration. This record is a thinking aid and its
// author is not her therapist; a page that lists appointments and a "focus" can
// start to look like a clinical file, and the one sentence that stops it is worth
// the space it costs. Where anything here and her clinician disagree, her
// clinician wins, and the page says so rather than leaving her to infer it.
export default async function Therapy() {
  const { focus, appointments } = await getTherapy();
  const forTherapist = (await getOpenLoops()).groups.find((g) => /appointment/i.test(g.heading));
  const pending = forTherapist?.items.filter((i) => !i.done) ?? [];

  return (
    <Enter>
      <PageHead
        route="/therapy"
        title="Therapy"
        sub="What you're working on, and what went unsaid."
      />

      <Banner>
        This is your own record of your appointments, kept in your words. It is not
        a clinical note and nothing here is a diagnosis. Where it and your
        therapist disagree, your therapist is right.
      </Banner>

      <SectionHead title="What you're working on" />
      {focus?.filled ? (
        <div className="card">
          {focus.sections
            .filter((s) => s.filled)
            .map((s) => (
              <section key={s.heading} className="card-section">
                <h3 className="card-heading">{s.heading}</h3>
                <Prose html={s.html} />
              </section>
            ))}
        </div>
      ) : (
        <Empty title="No current focus written down">
          What you and your therapist are working on goes here, in short — the
          detail stays with the appointment it came from.
        </Empty>
      )}
      <Source path="data/therapy/what_im_working_on.md" />

      {/* Verbatim, and above the appointment history on purpose: the thing she
          wants before walking into a room is the list she meant to bring. */}
      {pending.length > 0 && (
        <>
          <SectionHead title="To raise next time" note="in your words" />
          <div className="card">
            <ul className="bullets">
              {pending.map((item) => (
                <li key={item.text}>{item.text}</li>
              ))}
            </ul>
          </div>
          <Source path="data/state/open_loops.md" />
        </>
      )}

      <SectionHead title="Appointments" />
      {appointments.length === 0 ? (
        <Empty title="No appointments written up yet">
          After a session, what was said gets written down here first — before any
          of it is discussed.
        </Empty>
      ) : (
        appointments.map((appointment) => (
          <article key={appointment.slug} id={appointment.slug} className="view-section">
            <div className="section-head">
              <h2>{appointment.title ?? dateLabel(appointment.date)}</h2>
              {appointment.title && (
                <span className="section-note">{dateLabel(appointment.date)}</span>
              )}
            </div>
            <div className="card">
              <Prose html={appointment.html} />
            </div>
            <Source path={`data/${appointment.path}`} />
          </article>
        ))
      )}
    </Enter>
  );
}
