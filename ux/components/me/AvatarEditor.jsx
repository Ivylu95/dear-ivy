'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { Icon } from '@/components/ui/icons';

// Changing the picture. The only control in this app that writes anything.
//
// It sits on About me and nowhere else. The rail chip shows the picture and
// opens this page; it deliberately does not let her change it in passing, because
// a file picker one mis-click away from a nav row is a file picker she will open
// by accident on a bad night.
//
// What she sees after a change is the real file, re-read from disk — the upload
// finishes, router.refresh() re-runs the server components, and the new mtime
// arrives as a new URL. No optimistic preview: this surface's one promise is that
// what it shows is what is on disk, and an upload that silently failed while
// showing her the new photograph would break that promise at the only moment it
// matters.
const MESSAGES = {
  empty: 'That file was empty — nothing was changed.',
  too_large: 'That image is over 5MB. A smaller one will do.',
  unsupported: 'That is not an image this can show. PNG, JPEG, WebP or GIF.',
  read_only: 'Not here — this copy can only read. Change it on your own machine.',
  write_failed: 'It could not be saved. Nothing was changed.',
  unauthorised: 'Your session has expired. Sign in again.',
  network: 'It did not reach the server. Nothing was changed.',
};

export function AvatarEditor({ name, stamp }) {
  const router = useRouter();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // One path for both actions, because they fail identically and the difference
  // between them is a body and a verb.
  async function send(init) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/avatar', init);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(MESSAGES[body?.error] ?? MESSAGES.write_failed);
        return;
      }
      // The picture lives outside the React tree — it is a file the server reads
      // — so the refresh is what makes the rail chip and this page show it.
      router.refresh();
    } catch {
      setError(MESSAGES.network);
    } finally {
      setBusy(false);
      // So picking the same file twice in a row still fires a change event.
      if (input.current) input.current.value = '';
    }
  }

  function onPick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('avatar', file);
    send({ method: 'POST', body });
  }

  return (
    <div className="avatar-editor">
      <Avatar name={name} stamp={stamp} size={72} />

      <div className="avatar-editor-side">
        <div className="avatar-editor-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Icon name="quill" size={14} />
            {stamp ? 'Change photo' : 'Add a photo'}
          </button>

          {stamp && (
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => send({ method: 'DELETE' })}>
              Remove
            </button>
          )}
        </div>

        {/* The honest description of what "remove" does here. Nothing in this
            record is ever deleted, and a control labelled Remove that quietly
            kept the file would be a lie by omission — so it says so instead. */}
        <p className="avatar-editor-note" role={error ? 'alert' : undefined}>
          {error ?? (busy ? 'Saving…' : 'Kept with your record. Replacing one keeps the old.')}
        </p>
      </div>

      <input
        ref={input}
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onPick}
        aria-label="Choose a photo"
      />
    </div>
  );
}
