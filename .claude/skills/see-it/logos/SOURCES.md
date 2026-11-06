# Logo sources

Read when a page needs a logo, or a logo is added or re-checked.

Every logo the `see-it` skill may inline, on either route, where it came from,
and the hash it was vetted at. `../scripts/check-logos.mjs` refuses a file that
is not listed here, or whose sha256 differs from its row; it reports a row whose
Checked date is older than the re-ground interval in the skill's grounding log,
`dev/skills/see-it/log.md` (six months where a copy has no `dev/`). Full-colour official marks
only; a mono mark only where the brand publishes nothing else. Never recoloured:
a mark too dark for its ground goes on a white tile instead.

The marks are the trademarks of their owners, used here only to name their
products in a diagram (nominative use), unmodified, never to suggest
endorsement. They ship with the skill, so a page drawn in any copy uses the
same vetted files; one is added only in a development session (`../draw.md`
§ *Adding a logo*).

| Logo | File | Official source | Fetched from | Kind | Licence / trademark | Checked | sha256 |
|---|---|---|---|---|---|---|---|
| Claude | `claude.svg` | https://www.anthropic.com/press-kit (Anthropic press kit) | svgl `claude-ai-icon.svg` | colour (clay #D97757) | Anthropic trademark; press-kit use | 2026-11-04 | `0df6dad23995f5a76c6db8cc2a4e646ff45bd7a0626ef98662a7025646e5eea1` |
| Anthropic | `anthropic.svg` | https://www.anthropic.com/press-kit (Anthropic press kit) | svgl `anthropic_black.svg` | mono (the brand publishes it black or white only) | Anthropic trademark; press-kit use | 2026-11-04 | `51635844d2ae983077bb8c81f46b10d142542da4c23a06e9c2faf9154cc20af4` |
| GitHub | `github.svg` | https://brand.github.com/ (Invertocat) | svgl `github_light.svg` | mono (GitHub's mark is black or white only) | GitHub trademark; brand guidelines | 2026-11-04 | `64568845c83d5e840e6a1fb7af1939fed14709636427ce9be2fbcdc14ac5e021` |
| GitHub Actions | `github-actions.svg` | https://github.com/github/explore/blob/main/topics/actions/actions.png (GitHub's own topic logo) | that PNG, 288 px, wrapped unchanged in an SVG as a data URI | colour (blue) | GitHub trademark; GitHub publishes no SVG of it | 2026-11-04 | `b875e48389f5f4f4839632c06718c3457ab31dc15335eb6023d291757b194686` |
| Git | `git.svg` | https://git-scm.com/downloads/logos | svgl `git.svg` | colour (#DE4C36 diamond) | CC BY 3.0, author credited on git-scm.com | 2026-11-04 | `cc43d5b0c4fae45b6e0857c17d602c0efb8526241ca9623a29863867a8f59f3a` |
| Telegram | `telegram.svg` | https://telegram.org/tour/screenshots (brand assets) | svgl `telegram.svg` | colour (blue gradient) | Telegram trademark | 2026-11-04 | `05f6898c0c087f84c8bcf65e93721bde65abe34093045d4e9ecddbb8dc9f6a18` |
| Google Calendar | `google-calendar.svg` | https://calendar.google.com/ (the 2020 product icon, "31") | svgl `google-calendar.svg` | colour (Google four-colour) | Google trademark; Google brand permissions | 2026-11-04 | `643e0b6b34b278cf062bedcf798f894b7e8fa7b665793736664c5cf57f9f7873` |
| Next.js | `nextjs.svg` | https://vercel.com/geist/brands | svgl `nextjs_icon_dark.svg` | mono (Vercel publishes the N mark black or white only) | Vercel trademark | 2026-11-04 | `efa7511b383927ea64c2e44c918bc40146c648fbc16e0389df87df5263e492eb` |
| Node.js | `nodejs.svg` | https://nodejs.org/en/about/branding | the branding page's own file, https://raw.githubusercontent.com/nodejs/nodejs.org/main/apps/site/public/static/logos/jsIconGreen.svg | colour (green #5FA04E) | OpenJS Foundation trademark; Node.js brand guidelines | 2026-11-04 | `3c88b1a2261132b11d242fe8831525be051450e1149c965d5a5f1ded63e9b50d` |
| Vercel | `vercel.svg` | https://vercel.com/geist/brands | svgl `vercel.svg` | mono (the triangle is black or white only) | Vercel trademark | 2026-11-04 | `565f40e56abbd9c9f31e113c45e90ce456cc112d4811f2f49d1d5041fe501b7c` |
| React | `react.svg` | https://react.dev/ | svgl `react_light.svg` | colour (#087EA4) | Meta trademark | 2026-11-04 | `0e3b3b606248d4868b5f0c63c30f27929e94724591e28cbd6852ccb649857998` |
| ESLint | `eslint.svg` | https://eslint.org/branding | svgl `eslint-icon-light.svg` | colour (purple) | OpenJS Foundation trademark | 2026-11-04 | `02448e2d7bb5f5091ab651aeb2ad4bce08283c114d58fff96c54c3a245f07906` |
| npm | `npm.svg` | https://www.npmjs.com/ | svgl `npm.svg` | colour (red #CC0000) | npm, Inc. (GitHub) trademark | 2026-11-04 | `8fe7a9b3c30d7c44a4b7a431d6f943e30e374d8bde032d83377f2ab4e6a34544` |

svgl files were read from the svgl library's own repository
(https://github.com/pheralb/svgl, its static library folder), whose index of
marks links each to the brand's page above. svgl.app itself,
the Anthropic press-kit download, brand.github.com, telegram.org, git-scm.com and
vercel.com were refused by this machine's network on the checked date: those
marks were compared by eye against the brand's known mark, not against its own
download. The next re-ground fetches them from the brand pages where it can.
