'use client';

import Link from 'next/link';

// When a view fails to render.
//
// It says the record is intact, and it says it first. The files are plain text on
// disk and nothing here writes to them, so a broken page is a broken page and
// never a lost record — but someone looking at an error on a surface that holds
// their history has no way of knowing that unless it is stated.
//
// The safety numbers are not repeated here, because they live in
// data/safety/safety_plan.md and that file is the single source of them. A link to the
// page that reads it is the honest thing to offer.
export default function Error({ reset }) {
  return (
    <div className="enter">
      <h1 className="page-title">This page did not load</h1>
      <p className="note">
        Nothing is lost. Your record is plain text on disk and nothing here writes
        to it — this is the screen failing, not the record.
      </p>
      <div className="actions">
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link className="btn" href="/">
          Back to Now
        </Link>
        <Link className="btn" href="/safety">
          Safety plan
        </Link>
      </div>
    </div>
  );
}
