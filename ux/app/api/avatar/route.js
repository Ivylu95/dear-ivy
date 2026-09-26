import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionUser } from '@/lib/auth';
import { MAX_BYTES, readAvatarBytes, removeAvatar, saveAvatar } from '@/lib/avatar';

// The door to her picture: the one write route in this app.
//
// The file is data/assets/avatar.<ext> rather than something in public/, because
// a photograph of her is as personal as anything else in the record and HAR-02
// keeps everything personal in data/. Nothing under data/ is served statically,
// so it is served through here instead.
//
// Node runtime: this reads and writes the filesystem, which the Edge runtime has
// no access to.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The proxy already refuses anything without a session before this handler is
// reached. It is checked again here anyway, because this is the only route that
// CHANGES something, and the cost of the gate's matcher ever being loosened by
// someone who did not know that should not be a stranger writing into her record.
async function gate(request) {
  const account = await sessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  return account ? null : NextResponse.json({ error: 'unauthorised' }, { status: 401 });
}

export async function GET(request) {
  const denied = await gate(request);
  if (denied) return denied;

  const found = readAvatarBytes();
  // 404 rather than a placeholder image. The caller already knows whether there
  // is a picture — it is rendered from the same stamp — so this is only ever hit
  // in the moment after one is taken down, and a fallback served here would be
  // an avatar the UI could not tell apart from a real one.
  if (!found) return new NextResponse(null, { status: 404 });

  return new NextResponse(found.bytes, {
    headers: {
      'Content-Type': found.type,
      'Content-Length': String(found.bytes.length),
      // Private, and revalidated every time. The URL carries the mtime, so the
      // browser's own cache answers instantly while the picture is unchanged;
      // what this forbids is a shared cache anywhere between here and her
      // holding a copy of her face.
      'Cache-Control': 'private, no-cache, must-revalidate',
      ETag: `"${found.stamp}"`,
    },
  });
}

export async function POST(request) {
  const denied = await gate(request);
  if (denied) return denied;

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const file = form.get('avatar');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'empty' }, { status: 400 });
  }

  // Checked before the bytes are pulled into memory, so an accidentally picked
  // video is refused rather than buffered.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  const result = saveAvatar(Buffer.from(await file.arrayBuffer()));
  if (!result.ok) {
    const status = result.error === 'read_only' ? 503 : result.error === 'write_failed' ? 500 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, stamp: result.stamp });
}

// Takes the picture down. It does not delete it — see lib/avatar.js: the file
// moves to data/archive/ under the date it stopped being current, the
// same as a replacement does.
export async function DELETE(request) {
  const denied = await gate(request);
  if (denied) return denied;

  const result = removeAvatar();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, {
      status: result.error === 'read_only' ? 503 : 500,
    });
  }
  return NextResponse.json({ ok: true });
}
