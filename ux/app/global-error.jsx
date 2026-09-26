'use client';

import { serif } from './fonts';

// The last resort: the root layout itself failed, so there is no shell, no theme
// and no stylesheet to rely on. Everything here is inline for that reason.
//
// The face is the one exception to "inline everything", and it is imported
// rather than named: next/font generates the family name at build time, so
// there is no string that could be written here that would stay correct. The
// fallbacks after it are ordinary CSS ones, because this is the screen that runs
// when things have gone wrong and the font file is one of the things that could
// have — a serif stack behind it means the failure page still reads as part of
// the app rather than as a browser default.
const FACE = `${serif.style.fontFamily}, ui-serif, Georgia, 'Times New Roman', serif`;

export default function GlobalError() {
  return (
    <html lang="en">
      <body style={{ fontFamily: FACE, padding: 40, lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
        <p style={{ maxWidth: '60ch' }}>
          Your record is plain text on disk and nothing in this app writes to it, so
          nothing has been lost. Reloading usually fixes this.
        </p>
      </body>
    </html>
  );
}
