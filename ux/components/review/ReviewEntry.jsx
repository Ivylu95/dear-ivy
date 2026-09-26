'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/ui/icons';

// The verdict, attached to the one entry the panel is showing.
//
// ── Why this is the only control in the app that changes a file ─────────────
//
// `.claude/REVIEW.md` opens "Written by the agent; cleared by a person." The
// writing half worked from the first session; the clearing half had no surface,
// so the queue only ever grew, and clearing an item meant opening a markdown
// table in an editor and deleting a row by hand. A human approval gate nobody
// can reach is a backlog, not a gate.
//
// ── Why the verdict needs two clicks ────────────────────────────────────────
//
// Accept and Reject open a panel rather than firing. These are decisions about
// the specification — accepting a proposal is agreeing to change a binding
// register — and a control that files one on a single click is a control that
// files one by accident on the way past.
//
// The panel asks for a note and nothing else, and the note is optional. Making
// it required would only teach whoever is clearing a backlog of thirty to type a
// full stop thirty times, and a ledger of full stops is worse than a ledger of
// blanks: it looks like reasons were given.
//
// ── Why filing moves you on rather than staying put ─────────────────────────
//
// Because it has to, and because it should. An entry's id is a hash of the row's
// own text, and a verdict rewrites that row — so the address being read stops
// resolving at the instant it is acted on, and staying here would leave the
// reader on a URL that no longer names anything. The server hands down where the
// next unanswered entry is, and that is also simply the right place to go: this
// is a queue, and the thing after clearing one item is the next item.
const MESSAGES = {
  stale: 'That entry changed on disk since this page was read — nothing was filed.',
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

export function ReviewEntry({ id, decided, next }) {
  const router = useRouter();
  const [asking, setAsking] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function send(decision, why) {
    setBusy(true);
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
        // A stale id means the file moved underneath this page — a session
        // appended to the queue, or somebody decided this from another window.
        // The whole remedy is to go back and read what is actually there.
        if (body?.error === 'stale') router.push('/review');
        return;
      }
      // push, not refresh: this entry's id no longer names anything, because the
      // row it hashes has been rewritten. `next` is the server's answer to where
      // that leaves the reader.
      router.push(next ?? '/review');
      // So the queue beside the panel counts what is actually in the file now.
      // The layout holding it is not re-rendered by a push on its own.
      router.refresh();
    } catch {
      setError(MESSAGES.network);
    } finally {
      setBusy(false);
    }
  }

  function ask(decision) {
    setError(null);
    setNote('');
    setAsking((was) => (was === decision ? null : decision));
  }

  return (
    <div className="review-verdict">
      {error && (
        <p className="review-error" role="alert">
          {error}
        </p>
      )}

      {decided ? (
        <div className="review-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => send('reopen', '')}
          >
            <Icon name="loops" size={14} />
            {busy ? 'Reopening…' : 'Reopen this'}
          </button>
          <span className="review-hint">
            It goes back to the list it came from, and the log keeps a line saying
            the decision was reversed.
          </span>
        </div>
      ) : (
        <div className="review-actions">
          {Object.keys(INTENT).map((decision) => (
            <button
              key={decision}
              type="button"
              className={`btn btn-verdict${asking === decision ? ' is-open' : ''}`}
              data-verdict={decision}
              disabled={busy}
              aria-expanded={asking === decision}
              onClick={() => ask(decision)}
            >
              <Icon name={INTENT[decision].icon} size={14} />
              {INTENT[decision].label}
            </button>
          ))}
        </div>
      )}

      {asking && (
        <div className="review-confirm">
          <p className="review-intent">
            {INTENT[asking].lead}{' '}
            <span className="dim">
              It moves to Decided, word for word — nothing is deleted.
            </span>
          </p>
          <label className="sr-only" htmlFor="review-note">
            Why, in a line (optional)
          </label>
          <textarea
            id="review-note"
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
              disabled={busy}
              onClick={() => send(asking, note)}
            >
              {busy ? 'Filing…' : `File as ${INTENT[asking].filed}`}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy}
              onClick={() => setAsking(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
