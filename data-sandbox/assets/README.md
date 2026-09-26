# assets/

Files that are not words.

Everything else in `data/` is language — what she said, what happened, what she
decided — and it is read back to her in sessions. What lives here is not: it is
shown, not quoted. A picture among the standing files would be one more thing a
future reader has to work out the status of, so it gets its own folder instead.

| | |
|---|---|
| `avatar.png` (or `.jpg`, `.webp`, `.gif`) | Her picture, shown in the dashboard beside her name. One file, one of those four extensions. |

## Rules

- **Nothing here is ever deleted.** Replacing the picture, or taking it down,
  moves the old file to `data/archive/` as `YYYY-MM-DD_avatar.<ext>` — the date
  it stopped being current. The same rule, and the same archive, as everywhere
  else in this folder.
- **One file per thing, at a known name.** Nothing reads this folder by sweeping
  it; each file that belongs here is named by whatever needs it.
- **This is the one place the dashboard writes.** Every other file in `data/` has
  exactly one author — the agent she talks to. The exception is `DSH-002`,
  *"The single exception to DSH-001 is a thing she made rather than said: it is
  never read back to her as her own account of anything."* `ux/lib/avatar.js` is
  the code that holds it, and says why it is drawn this narrowly.
