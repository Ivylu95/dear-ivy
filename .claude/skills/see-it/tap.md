# See it: tapping a page

Read when a page is built, on either route, beside that route's part.

**Goal:** Every page answers a tap (A-168, FIT-005); a page that only shows is not finished.

| Page | What a tap does |
|---|---|
| A diagram ([`template.html`](template.html)) | A node is a `<button>` with `data-id` and `data-detail`: tapping it lights and animates its whole route and opens the card; tap again, Close or Escape. A shared box's edge may name `data-for`, the senders it carries. A group that can be hidden has `data-group`, its nodes `data-in`, and one chip with `data-toggle` |
| A timeline, a week, steps ([`template-steps.html`](template-steps.html)) | Each line opens to its detail (`<details>`); *One at a time* steps through with Back and Next; a chip shows only the lines carrying its tag |

- **Every page uses the template's floating card**, never a box below the drawing (`dev/skills/see-it/test-tap-route.mjs`).
- **Every edge names its ends**, `data-from` and `data-to`, on the path and on
  its label.
- **The detail is what was said or written**, in a few plain sentences as
  [`.claude/writing.md`](../../writing.md) says, never a reading. On her route, her words or her record's; a chip names only
  something she named.
- **Touch first:** every control at least 44px tall, with a visible focus ring;
  nothing depends on hover.
- **It reads without the script.** Lines open; a diagram shows
  everything. Nothing is stored, fetched or sent.
- **Prove it.** Where a browser is to hand, open the built page at 360 wide.
  Tap a box and a chip, or a line and *One at a time*. Look at the screenshot
  afterwards, in both themes. If nothing visibly changed, it fails. With no
  browser, say it was not tapped.
