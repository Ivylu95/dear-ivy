'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Prose, SectionHead, Tag } from '@/components/ui';
import { Icon } from '@/components/ui/icons';

// The review queue, with the verdict attached to each item.
//
// ── Why this one is interactive when nothing else here is ───────────────────
//
// Every other view in this app is a window onto something a person or the agent
// wrote elsewhere. This one is the exception, and the reason is in the file it
// renders: `.claude/REVIEW.md` opens "Written by the agent; cleared by a
// person." A queue with no way to clear it is not a queue, it is a list that
// grows — and that is what it had become, because clearing an item meant
// opening a markdown table in an editor and deleting a row by hand.
//
// ── Why an entry is a ledger row and not a card ─────────────────────────────
//
// Three columns: what it cites, what it says, what can be done about it. The
// citation sits in a gutter of its own because that is how every one of these
// is found — `specs/README.md` asks that a row be cited by ID, and a page where
// the IDs line up down one edge can be scanned for one of them without reading
// a word of the prose beside it.
//
// The prose column is capped at the reading measure even though the view runs
// wide. Several of these findings are four hundred words of argument, and the
// width is there to give the citation and the controls room of their own — not
// to stretch a paragraph to a hundred and ten characters a line.
//
// ── Why the verdict needs two clicks ────────────────────────────────────────
//
// Accept and Reject open a panel rather than firing. These are decisions about
// the specification — accepting a proposal is agreeing to change a binding
// register — and a control that files one on a single click is a control that
// files one by accident on the way past.
//
// The panel asks for a note and nothing else, and the note is optional. Making
// it required would only teach whoever is clearing a backlog of twelve items to
// type a full stop twelve times, and a ledger of full stops is worse than a
// ledger of blanks: it looks like reasons were given.
//
// ── Why it says what it is about to do ──────────────────────────────────────
//
// The line above the note spells out where the row is going and that nothing is
// deleted, because "Accept" on its own does not say whether it means the finding
// stands or the work is done. Both readings are natural and they are opposite.
const MESSAGES = {
  stale: 'That entry changed on disk since this page was read — nothing was filed. Reloading.',
  read_only: 'Not here — this copy can only read. Clear the queue on your own machine.',
  write_failed: 'It could not be written. Nothing was changed.',
  no_file: 'There is no review queue file where this app is running.',
  bad_request: 'That did not make sense to the server. Nothing was changed.',
  unauthorised: 'Your session has expired. Sign in again.',
  network: 'It did not reach the server. Nothing was changed.',
};

// What each verdict means, said in full at the moment it is about to be filed.
// Worth the words: "Accept" alone reads as both "the finding is right" and "the
// work is done", and those are different things to write into a ledger.
const INTENT = {
  accept: {
    label: 'Accept',
    filed: 'accepted',
    lead: 'The finding stands and the change it asks for should be made.',
    icon: 'safety',
  },
  reject: {
    label: 'Reject',
    filed: 'rejected',
    lead: 'The finding does not stand, or the change should not be made.',
    icon: 'close',
  },
};

// Accepted reads as settled, rejected as closed, reopened as neither. The tones
// are the ones the rest of the app already uses, so a colour means the same
// thing here as it does on a safety tag.
const TONE = { Accepted: 'ok', Rejected: 'quiet', Reopened: 'warn' };

export function ReviewQueue({ queues, decided }) {
  const router = useRouter();
  // One item is open at a time — `${id}:${decision}` — because two half-written
  // verdicts on screen is two things to finish and no way to tell which one the
  // note belongs to.
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function send(id, decision, why) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, note: why ?? '' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(MESSAGES[body?.error] ?? MESSAGES.write_failed);
        // A stale id means the file moved underneath this page. Re-reading is
        // the whole remedy, and it is more useful than the sentence saying so.
        if (body?.error === 'stale') router.refresh();
        return;
      }
      setOpen(null);
      setNote('');
      // The queue lives on disk, outside the React tree, so this is what makes
      // the item move from one list to the other. No optimistic update: this
      // surface's one promise is that what it shows is what is in the file.
      router.refresh();
    } catch {
      setError(MESSAGES.network);
    } finally {
      setBusy(null);
    }
  }

  function ask(id, decision) {
    const key = `${id}:${decision}`;
    setError(null);
    setNote('');
    setOpen(open === key ? null : key);
  }

  const total = queues.reduce((n, queue) => n + queue.items.length, 0);

  return (
    <>
      {error && (
        <p className="review-error" role="alert">
          {error}
        </p>
      )}

      {queues.map((queue) => (
        <section className="review-queue" key={queue.key}>
          {/* The shared section head, with the id named rather than derived, so
              the rail's anchors and the queue keys the rest of this component
              works in are the same string. */}
          <SectionHead
            title={queue.heading}
            id={queue.key}
            note={queue.items.length === 0 ? 'nothing open' : `${queue.items.length} open`}
          />
          <p className="review-blurb">{queue.blurb}</p>

          {queue.items.length === 0 ? (
            <Cleared>Nothing here is waiting on a decision.</Cleared>
          ) : (
            <ul className="review-list">
              {queue.items.map((item) => {
                const asking = open?.startsWith(`${item.id}:`) ? open.split(':')[1] : null;
                return (
                  <li
                    className="review-item"
                    key={item.id}
                    data-busy={busy === item.id || undefined}
                    data-asking={asking || undefined}
                  >
                    <Cite ids={item.ids} />

                    {/* Wrapped rather than given the class directly, so an open
                        entry and a decided one have the same shape: the decided
                        one has the note under the finding, and <Prose> can only
                        be one of the two. Same structure, same treatment. */}
                    <div className="review-said">
                      <Prose html={item.html} />
                    </div>

                    <div className="review-actions">
                      {Object.keys(INTENT).map((decision) => (
                        <button
                          key={decision}
                          type="button"
                          className={`btn btn-verdict${asking === decision ? ' is-open' : ''}`}
                          data-verdict={decision}
                          disabled={busy === item.id}
                          aria-expanded={asking === decision}
                          onClick={() => ask(item.id, decision)}
                        >
                          <Icon name={INTENT[decision].icon} size={14} />
                          {INTENT[decision].label}
                        </button>
                      ))}
                    </div>

                    {asking && (
                      <div className="review-confirm">
                        <p className="review-intent">
                          {INTENT[asking].lead}{' '}
                          <span className="dim">
                            It moves to Decided, word for word — nothing is deleted.
                          </span>
                        </p>
                        <label className="sr-only" htmlFor={`note-${item.id}`}>
                          Why, in a line (optional)
                        </label>
                        <textarea
                          id={`note-${item.id}`}
                          className="review-note"
                          rows={2}
                          maxLength={280}
                          value={note}
                          placeholder="Why, in a line — optional, and kept with the entry."
                          onChange={(event) => setNote(event.target.value)}
                        />
                        <div className="review-confirm-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy === item.id}
                            onClick={() => send(item.id, asking, note)}
                          >
                            {busy === item.id ? 'Filing…' : `File as ${INTENT[asking].filed}`}
                          </button>
                          <button
                            type="button"
                            className="btn btn-quiet"
                            disabled={busy === item.id}
                            onClick={() => setOpen(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <section className="review-queue">
        <SectionHead
          title="Decided"
          id="decided"
          note={decided.length === 0 ? 'nothing yet' : `${decided.length} cleared`}
        />
        <p className="review-blurb">
          What has been cleared, and how. Appended to, never rewritten — a
          decision can be reopened, and the reversal is recorded rather than the
          decision erased.
        </p>

        {decided.length === 0 ? (
          <Cleared>
            {total === 0 ? 'Nothing has been raised yet.' : 'Nothing has been cleared yet.'}
          </Cleared>
        ) : (
          <ul className="review-list">
            {decided.map((row) => (
              <li
                className="review-item is-done"
                key={row.id}
                data-busy={busy === row.id || undefined}
              >
                <Cite ids={row.ids}>
                  <Tag kind={TONE[row.verdict] ?? 'quiet'}>{row.verdict}</Tag>
                  <span className="review-when">{row.when}</span>
                </Cite>

                <div className="review-said">
                  <Prose html={row.html} />
                  {/* The sentence whoever decided it left behind, under the
                      finding rather than beside it: it is a reply to those
                      words and reads as one only in that order. */}
                  {row.why && <p className="review-why">{row.why}</p>}
                </div>

                <div className="review-actions">
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={busy === row.id}
                    onClick={() => send(row.id, 'reopen', '')}
                  >
                    <Icon name="loops" size={14} />
                    {busy === row.id ? 'Reopening…' : 'Reopen'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// The citation gutter: the spec IDs this finding is about, stacked.
//
// One per line rather than run together with commas, because the column exists
// to be scanned down for an ID and a list that wraps mid-cell defeats that. A
// decided row hangs its verdict and its date under the same column, so the
// whole of "which rule, and what happened to it" sits in one place.
function Cite({ ids, children }) {
  return (
    <div className="review-cite">
      {ids.map((id) => (
        <span className="review-id" key={id}>
          {id}
        </span>
      ))}
      {children}
    </div>
  );
}

// An empty queue is not a gap — it is the state this whole view exists to
// reach, so it is said in the same voice <Empty> uses and without its outline.
function Cleared({ children }) {
  return (
    <p className="review-clear">
      <Icon name="leaf" size={15} />
      {children}
    </p>
  );
}
