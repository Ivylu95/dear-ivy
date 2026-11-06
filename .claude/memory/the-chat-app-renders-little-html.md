# The chat app renders little HTML, and every line is a paragraph

Found 2026-09-30, shaping development replies (`DEV-002`, `DEV-005`) against the
developer's phone screenshots. Tried, reversed, and easy to try again, because
each looks right in any Markdown preview and wrong only in the app.

| Tried | What the app did | Kept instead |
|---|---|---|
| `<br>` inside a line, to stack short lines tightly | Printed `<br>` as literal text | One line joined with `·`, or separate lines accepting the gap |
| Several short lines, each ending in two spaces | Each line rendered as its own paragraph, with a paragraph's gap between them | Fewer lines: a vertical stepper took a whole screen and became a one-line breadcrumb |
| A fenced code block, to keep lines tight | Tight, but read as code, and the developer did not want a box | Plain lines under the label |
| Several ordinary spaces for width | Collapsed to one | An em space (U+2003), which the app keeps |
| `<sub>…</sub>` for small text | Small in the phone app, printed raw in the desktop editor (2026-10-03) | Dropped: plain Markdown only, `🛠️ **Dev Mode · <shape>**` and a quote line (WKB-009) |

**Before shaping anything a person reads in the app, check it on the device.**
A Markdown renderer on a desk is not the app, and the app is not the desktop editor: the developer reads on both, so a reply is checked on both (WKB-009). `.claude/hooks/lib/dev-reply.mjs` refuses a
`<br>` header and holds the one-line breadcrumb, so the reply shape cannot drift
back; this note is for anything else rendered in the same app.
