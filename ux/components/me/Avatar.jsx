// Her face, or her initial.
//
// Presentational and hook-free on purpose, so the same component renders in the
// rail (a client component) and on the About me page (a server one) and the two
// can never disagree about what she looks like.
//
// `stamp` is the picture's mtime, read on the server by lib/avatar.js. It does
// two jobs: it says whether there IS a picture, and it is the cache-buster in the
// URL — without it the browser goes on showing the previous photograph after an
// upload, because a same-URL image is the one thing a refresh does not reliably
// re-fetch.
export function Avatar({ name, stamp, size = 26, className }) {
  const initial = String(name ?? '').slice(0, 1).toUpperCase();
  const classes = `avatar${className ? ` ${className}` : ''}`;
  const style = { width: size, height: size };

  if (!stamp) {
    // The initial scales with the disc rather than being declared per size in
    // the stylesheet, so a 26px chip and a 72px header are one component with
    // one look instead of two that drift.
    return (
      <span
        className={classes}
        style={{ ...style, fontSize: Math.round(size * 0.42) }}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  return (
    // next/image optimises by fetching the source through its own loader, which
    // cannot reach a route behind the session gate — and there is exactly one of
    // these on a page, at 26 or 72px.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${classes} avatar-photo`}
      style={style}
      src={`/api/avatar?v=${stamp}`}
      // Empty, because this is decoration beside her own name, which is already
      // there in text. "Photograph of <her name>", read out before every nav row, is
      // noise on the one surface that should be quiet.
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}
