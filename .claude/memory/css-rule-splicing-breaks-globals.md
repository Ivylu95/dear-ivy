# Don't splice rules into globals.css, and don't trust lint to catch it

_2026-09-21_

Two breakages in [`ux/app/globals.css`](../../ux/app/globals.css) in one
session, from the same habit, neither caught by `npm run lint`.

## What broke

**A rule wedged into a selector list.** A new declaration was inserted between
the two selectors of `.settings-trigger, .foot-link { … }`:

```css
.settings-trigger,                                  /* orphaned into the rule below */
.sidebar-toggle, .settings-trigger, .foot-link, .profile-name {
  font-family: var(--f-display);
}
.foot-link { gap: 12px; padding: 9px 10px; … }      /* Settings no longer matched */
```

`.settings-trigger` kept only the `display: flex` it takes from the chrome-button
block further up, and lost its gutter, its padding, its `--text-ui` and its
`text-align: left`. The Settings row in the sidebar foot rendered as a large
centred word with its icon floating off to the left — valid CSS, no error
anywhere, a visibly broken control.

**A selector dropped outright.** Inside `@media (min-width: 901px)`, the
selector `.rail-sticky` went missing and left its declarations bare after the
comment that introduced them. Turbopack refused the file: _Invalid empty
selector_. Had it compiled, the right rail would have kept `position: sticky`
inside a `.main` that is its own scroller — drift on the first screenful, and no
pin at all once its containing block passed.

## Why this file invites it

The rules here are separated by long prose comments, so in a diff a trailing
selector and the comment introducing the next rule look alike. The shape that
invites splicing is a declaration that applies to _some_ of an existing rule's
selectors: adding the name to the list reads as the tidy thing to do, and it is
how a rule loses a selector it needed.

## The rule

**A declaration for a subset of an existing rule's selectors gets its own rule
below it.** Never a name added to that list, never a block wedged inside it. The
shared rule stays the shape of the thing it describes; a second rule underneath
says the one extra thing, with a comment saying why it is separate.

## The gate

**`npm run build`, not `npm run lint`.** Neither of the two checks the project
ships sees CSS at all:

- `npm run lint` is `eslint app components lib` — it never parses the stylesheet.
- `npm run check` is the four safety, config, privacy and link scripts.

PostCSS's own parser is also more forgiving than Turbopack's and accepted the
empty selector, so a `postcss.parse()` smoke test passes on a file the dev server
rejects. A fast sweep for the same class of fault, when the build is slow: strip
comments, check brace balance, and look for any `{` preceded only by whitespace
since the last `}` or `;`.
