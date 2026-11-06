# ux

The human interface layer: a Next.js dashboard over the same files the sessions
read, never a copy (ARC-009). Its specs are in [`../dev/specs/ux/`](../dev/specs/ux/README.md);
how to run it is in the root [`README.md`](../README.md).

| Folder | What it holds |
|---|---|
| [`app/`](app/README.md) | Routes, layouts and API handlers |
| [`components/`](components/README.md) | The React components the routes are built from |
| [`config/`](config/) | Values that vary by deployment, kept out of the code |
| [`lib/`](lib/) | Server-side readers and helpers: the record (`content-read.js`, by subject in `ux/lib/read/`), the harness, auth; and `checks.mjs`, the one list of checks the gate, `npm run check` and CI read |
| [`test/`](test/) | Unit tests for `lib/`, run against the invented record in `data-sample/` (`node test/run.mjs`) |
| [`scripts/`](scripts/) | The checks behind `npm run check`, and the spec and sandbox tools |
| [`theme/`](theme/) | The design tokens `generate-theme.mjs` builds the CSS from |
