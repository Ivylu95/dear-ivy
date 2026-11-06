'use client';

import { useState } from 'react';
import { BrandMark } from '@/components/ui/icons';

// The gate's only page.
//
// Deliberately says nothing about what is behind it. No "therapy record", no
// name beyond the app's own, no hint of what a successful login would show. A
// login page is the one screen a stranger is guaranteed to reach, and it should
// tell them nothing they did not already know.
export default function Login() {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password'),
      }),
    });

    if (response.ok) {
      // A full document load rather than a client navigation, and the lint rule
      // against that is suppressed rather than obeyed.
      //
      // This page is not reached by navigating to /login. The proxy REWRITES it
      // over whatever URL was requested, so the browser's address bar may say
      // /timeline while this form is on screen. A client-side push from here
      // would be resolved against that URL and against a router cache populated
      // while there was no session; a full load discards both and lets the proxy
      // decide afresh with the cookie that was just set.
      //
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/';
      return;
    }

    setBusy(false);
    // One message for every failure. Saying which half was wrong tells whoever is
    // guessing which half they already had right, and 503 is the only case worth
    // distinguishing because it is a misconfiguration rather than a bad guess.
    setError(
      response.status === 503
        ? 'Sign-in is not set up on this machine yet.'
        : 'That did not match.',
    );
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <BrandMark size={24} />
          {/* "Dear you", which is what the rail says before she has told it a
              name — and the gate never knows one, so it is the honest wordmark
              here rather than a fallback. It also finishes the sentence: "Dear"
              alone read as a salutation cut off mid-word, or as a title that had
              failed to load.

              No name, ever. This page is served to anyone who reaches the
              origin, so it carries the product and nothing about whose record is
              behind it. The wordmark inside the app is the one that knows.

              The tagline is the same line the rail carries, and it is safe here
              for the same reason: it says what this is, never whose. */}
          <span className="login-text">
            <span className="login-title">Dear you</span>
            <span className="login-tag">A space to think out loud</span>
          </span>
        </div>
        <p className="login-sub">Private. Sign in to continue.</p>

        <label className="field">
          <span>Name</span>
          <input
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
