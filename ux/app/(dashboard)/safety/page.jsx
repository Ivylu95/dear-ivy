import Link from 'next/link';
import { Empty, Enter, PageHead, Prose, SectionHead, Source } from '@/components/ui';
import PrintButton from './PrintButton';
import { getSafetyPlan } from '@/lib/content';

export const dynamic = 'force-dynamic';

// ══════════════════════════════════════════════════════════════════════════
// The safety plan. The one page in this app with a job other than being read.
//
// Everything about it is built for the state it will actually be opened in,
// which is the worst one. Four decisions follow from that, and none of them is
// a style choice:
//
// 1. THE NUMBERS ARE FIRST. The first content on the page, above her own plan
//    and above every section of it. Nothing has to be scrolled past to reach
//    them, because scrolling past things is exactly what is hard right now.
//
//    They sat above the PAGE TITLE until this was written, which is a different
//    and weaker claim than the one that matters. The title is one line and the
//    subtitle another; neither is scrolled past, and putting the numbers under
//    them costs nothing measurable while making this view open like the other
//    nine. If a change ever does push them below the fold on a phone, that is
//    the line being crossed — not this one.
//
// 2. THEY ARE TEL: LINKS, SET LARGE. One tap dials. Not a number to copy out,
//    not a number to read and remember, and not a size that needs aim. The size
//    is --text-number, which grows with the reading style like everything else.
//
//    They are also the only saturated thing on the page. The block around them
//    used to be an --alert panel; it is paper now, and the red is spent on the
//    digits alone. Red on red was the worst contrast available for the one
//    element that must never be hard to read — see the note on .crisis in
//    globals.css.
//
//    The heading above them is an ordinary section head — the same component
//    every other section of this page, and every other view in the app, opens
//    with. It was a bespoke bold row with a phone glyph, sealed inside the panel
//    behind a second rule of its own, which made the first section of the safety
//    plan the only section in the surface that announced itself differently from
//    all the rest. DES-001 asks for one appearance per piece of recurring
//    chrome, and a section heading is the most recurring piece there is.
//
//    Nothing that made the numbers findable was spent on that. The panel keeps
//    its boundary and is still the one sheet here that reads as a bounded
//    object; the heading keeps the alert role; the digits keep the size. What
//    went was a second glyph vocabulary and a second horizontal rule doing the
//    job the section head's own rule already does.
//
// 3. THEY COME OUT OF data/safety/safety_plan.md, NOT OUT OF THIS FILE. Her record is
//    the source of them. A copy in the code is a copy that goes out of date
//    without anyone noticing, and the failure mode is a wrong number on the
//    worst night.
//
// 4. HER OWN WORDS OUTRANK ANYTHING HERE. CLAUDE.md asks that her warning signs
//    and her reasons — written on a better day — be read back to her, because
//    they are worth more than anything this could say. So her reasons are
//    lifted out of the plan's ordering and put directly under the numbers, and
//    this page adds no encouragement of its own anywhere.
//
// What this page must never become: a mood check, a risk score, a thing that
// asks her how she is. It is a phone book and a letter from herself.
// ══════════════════════════════════════════════════════════════════════════

export default async function Safety() {
  const plan = await getSafetyPlan();

  if (!plan) {
    return (
      <Enter className="plan-view">
        <PageHead route="/safety" title="Safety plan" />
        <Empty title="No safety plan on file">
          A safety plan is built with a therapist or care team, not alone.
        </Empty>
      </Enter>
    );
  }

  return (
    <Enter className="plan-view">
      <PageHead
        route="/safety"
        title="Safety plan"
        sub="Written on a better day, for a worse one."
      >
        {/* Paper needs no battery and no password. The afternoon to print this is
            not the night it is needed, so the offer has to be visible now. */}
        <PrintButton />
      </PageHead>

      {/* The first section under the head, on every state of this page, and
          shaped like every other section on it: a section head, then one sheet.

          It used to sit ABOVE the head, which made this the one view in the app
          that opened with an untitled panel and named itself underneath. That
          bought nothing: a page title is not something you scroll past, and the
          numbers are still the first content, still above the fold on any
          screen, still ahead of her own plan. What it cost was that the safety
          plan was the only tab that did not look like a tab.

          The id sits on the wrapper rather than on the heading, which is what
          anchorHere={false} is for. The rail beside this page lists this row
          first, and a jump to it should land on the top of the section rather
          than partway into it.

          This block has THREE states, and the second and third exist because
          SAF-02 says these numbers must be present at the moment they are
          needed, and because the parser has already been wrong once.

          The structured block is the good case. If the parse ever comes back
          empty — a reformatted plan, a renamed heading — the section does not
          quietly disappear: it falls back to the file's own words, unparsed, and
          says out loud that it could not read them. An empty box where the
          numbers used to be is the one outcome not allowed here, because it is
          indistinguishable from a plan that never had any. */}
      <section id="if-you-need-help-right-now" className="view-section is-crisis">
        <SectionHead title="If you need help right now" anchorHere={false} />
        <div className="crisis">
          {plan.contacts.length > 0 ? (
            plan.contacts.map((contact) => (
              <div key={`${contact.label}-${contact.number}`} className="crisis-line">
                <span className="crisis-who">{contact.label}</span>
                <a className="crisis-num" href={`tel:${contact.number.replace(/\s+/g, '')}`}>
                  {contact.number}
                </a>
                {contact.note && <span className="crisis-note">{contact.note}</span>}
              </div>
            ))
          ) : (
            <>
              <p className="crisis-degraded">
                These could not be read as numbers, so they are shown here exactly
                as they are written in your plan.
              </p>
              {plan.urgentHtml ? (
                <Prose html={plan.urgentHtml} className="crisis-raw" />
              ) : (
                <p className="crisis-degraded">
                  Nothing could be read from <code>data/safety/safety_plan.md</code> at all.
                  If you need someone now and this page is not helping, call your
                  local emergency number.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {!plan.filled ? (
        <>
          <Empty title="The plan itself is still empty">
            The numbers above work regardless. The rest — your warning signs, what
            helps, who to call — is meant to be filled in with your therapist or
            care team, not on your own.
          </Empty>
          <div className="plan-lead">
            <Prose html={plan.lead} />
          </div>
        </>
      ) : (
        <>
          {/* Who the plan was built with, and when it was last looked at. It is
              the file's own opening line and it was rendered only on the empty
              page, so the one version of this page anybody actually reads was
              the one that never said how old it was — on the one document where
              that matters, because a plan names people and a number, and both go
              stale. It sits here rather than under the title so that nothing at
              all comes between the head and the numbers. */}
          {plan.lead && (
            <div className="plan-lead">
              <Prose html={plan.lead} />
            </div>
          )}

          {/* Already in reading order -- her reasons and what helps her on her
              own first -- because lib/content.js lifts them there. The rail
              beside this page lists the same array, so the two cannot disagree
              about what is on the page or in what order. */}
          {plan.sections.map((section) => (
            <section key={section.heading} className="view-section">
              <SectionHead title={section.heading} />
              {section.filled ? (
                <div className="card">
                  {/* The people this section names who have a number on file,
                      above her own words about them rather than woven into
                      them. Her table says WHEN to call Orla and what calling
                      her is like; this is the tap that does it, and the two are
                      different things — rewriting her table to carry a link
                      would be editing what she wrote.

                      Same rows as the crisis block, deliberately. It is the
                      one geometry in this app that means "a number to dial",
                      and a second one would make her ask which kind this is.

                      Someone with no number on file still gets a row, and it
                      is then a way into their file rather than a way to ring
                      them. Her plan says who to call and when; everything else
                      she knows about them is one click from it instead of in a
                      tab she has to go and find. */}
                  {section.people.length > 0 && (
                    <div className="dial">
                      {section.people.map((person) => (
                        <div key={person.slug} className="crisis-line">
                          <span className="crisis-who">
                            <Link href={`/people/${person.slug}`}>{person.name}</Link>
                          </span>
                          {person.phone && (
                            <a
                              className="crisis-num"
                              href={`tel:${person.phone.replace(/\s+/g, '')}`}
                            >
                              {person.phone}
                            </a>
                          )}
                          {person.relation && (
                            <span className="crisis-note">{person.relation}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <Prose html={section.html} />
                </div>
              ) : (
                <Empty title="Not filled in yet">
                  Worth doing with your therapist rather than alone.
                </Empty>
              )}
            </section>
          ))}
        </>
      )}

      {/* Paper only, and only when the numbers actually parsed.

          The plan on a cupboard door and a card in a wallet are two different
          objects doing two different jobs, and the card is the one that works in
          a place she did not plan to be, on a phone that has gone flat. It
          prints on its own page with a cut line.

          Rendered from `plan.contacts` — the same array the block at the top of
          the page renders, out of the same parse of the same file. A card
          assembled from its own copy of the numbers is exactly the second copy
          SAF-002 is about, and this page would be a strange place to introduce
          one. */}
      {plan.contacts.length > 0 && (
        <aside className="wallet" aria-hidden="true">
          <div className="wallet-head">If you need help right now</div>
          {plan.contacts.map((contact) => (
            <div key={`card-${contact.label}-${contact.number}`} className="crisis-line">
              <span className="crisis-who">{contact.label}</span>
              <span className="crisis-num">{contact.number}</span>
            </div>
          ))}
          <div className="wallet-foot">Cut out and keep. From your own safety plan.</div>
        </aside>
      )}

      <Source path="data/safety/safety_plan.md" />
    </Enter>
  );
}
