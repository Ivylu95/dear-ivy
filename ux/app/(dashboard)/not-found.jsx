import Link from 'next/link';

// The 404 for routes INSIDE the shell, where the sidebar and the rail stay up —
// being lost somewhere you are allowed to be is a different problem from landing
// on an address that is not part of the app, which app/not-found.jsx handles.
//
// It shares that page's headline so the two read as one app, and then says the
// thing only this one is allowed to say: behind the gate, a page that is not
// here is very often a file that has not been written yet rather than a mistake.
export default function NotFound() {
  return (
    <div className="enter">
      <h1 className="page-title">Nothing written here</h1>
      <p className="note">
        That page does not exist — or that file has not been written yet, which
        happens far more often and is not a fault.
      </p>
      <div className="actions">
        <Link className="btn" href="/">
          Back to Now
        </Link>
      </div>
    </div>
  );
}
