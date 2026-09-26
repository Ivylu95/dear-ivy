# Dashboard Privacy [DPV]

The binding privacy specification for the read surface: what the surface exposes, what it is allowed to send anywhere, and what must remain true of that perimeter as the surface grows.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

The provisions below fix this specification's purpose and the reach of its authority — how this file is to be read, obeyed, and bounded. The register further down governs the surface's perimeter instead.

| #   | Provision                                                                     | What it means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The perimeter is knowable from this file alone.**                           | The surface is the one part of this system that listens on a port, and an agent will keep adding routes to it. Code shows which routes exist, commits only which were added; neither states what the boundary was meant to be. This file states both: a person learns where the perimeter runs and why it runs there, and an agent builds to it whenever it adds anything that can be reached. If a new route's treatment cannot be decided from this file, that gap is a defect to raise.                                                                                                                                                       |
| 2   | **This specification binds where it speaks, and is silent where it doesn't.** | Compliance with a spec statement is mandatory: an agent chooses how to satisfy it, never whether to. Where it judges a statement wrong, it keeps following it as written and suggests the change with its reasons, which takes effect only on human review and approval. A design recommendation is a guide; an agent may take another path, but records the departure and its reasons for review, and never amends the row itself. Silence here is not permission — a route that reaches personal content and that no row anticipated is a gap to raise **before** it ships, because the cost of guessing wrong on this file is the record itself. |
| 3   | **It governs reach, never content.**                                          | This file settles who can get to the record through the surface, what the surface may send outward, and what anything between her and it is allowed to keep. It says nothing about what the record contains or how a view renders it — that is the interaction specs' and the dashboard's own business. A privacy argument is never grounds for changing what the record says; where a view must not show something, that is the dashboard's row to write, not this one's.                                                                                                                                                               |
| 4   | **Each spec family owns its own domain.**                                     | [`../data/access.md`](../data/access.md) owns **whether she can open the record at all** — the repository's membership, the gate's cryptography, what a failed sign-in reveals, how access is revoked. This file owns **the surface's own perimeter**: which routes are shut, which bytes may leave, and what a cache or a browser may keep. [`purpose.md`](purpose.md) owns what the surface may *do*. A row here never restates a `PRV` rule; it points at it. Where two appear to bind the same question, the more specific governs, and the overlap is raised rather than settled quietly.                                                                       |

---

## The Perimeter

The territory this specification governs: every way a byte can cross out of this system, in the order a request meets them.

Anything that can be reached without a session is a hole in the perimeter by definition, so the open list is short enough to read in one glance and long enough to be the whole of it.

```bash
request
├── the gate                  # default deny; everything below is the exception
│   ├── the sign-in page      # open: must render before a session exists
│   ├── the sign-in route     # open: it is how a session is obtained
│   ├── the sign-out route    # open: ending a session must never require one
│   └── static build assets   # open: carry nothing personal, by construction
├── gated routes              # every view, and every route serving personal bytes
│   └── the record            # read at request time; never a static asset
└── outward                   # what the surface itself sends
    ├── nothing to a third party
    └── the browser           # presentation preferences only, never the record
```

> 🧭 **The perimeter above is the owner's design** — what the boundary should be, not what today's router happens to match. Build to it.

---

## Specifications Register

The normative part of this file. Each row is one thing that must be true of the surface's perimeter; how a row is read is in [`README.md`](../README.md).

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **DPV-001** | Every route is shut unless it is named as open.                                           | Default-open with exceptions and default-shut with exceptions look identical on the day they are written and diverge on every day after: the first leaks each route someone forgets to add. The matcher that carves out static assets is the live risk — an unterminated or unescaped name is a prefix, and a prefix is a bypass.                        | One gate in front of everything, denying by default. The open list is an explicit allowlist — the sign-in page, the route it posts to, the way out — and it is short enough to read in a glance. A new route is gated by existing, not by being remembered.                       |
| **DPV-002** | Nothing personal is ever served by anything but a gated route.                            | The temptation is a build step that copies one harmless-looking file somewhere public so a framework can optimise it. A static asset has no session and cannot acquire one; the moment a personal byte becomes one, the gate has been opted out of for that byte and nothing anywhere will say so.                                                       | The record is read at request time and never published as a static asset. A personal file that is not text — a picture, an attachment — is still served by a route behind the gate, never from a public directory, whatever it costs in convenience.                              |
| **DPV-003** | The credentials belong to the record, not to the surface that displays it.                | A missing file is the deployed case, not a fault — so it is silence, never a throw: the gate is the whole of the protection between this record and the open internet and must not fail to start over an absent development convenience. Where configuration is read at module load, changing it needs a restart, not just an edit — see PRV-005.        | They live with the record rather than inside the app, and the app reads them from there. A value already in the real environment always wins over a file, so a hosted deployment is configured by its platform and a stray file can never displace it. See PRV-003 for the rule that they never enter version control. |
| **DPV-004** | The surface makes no request she did not make.                                             | This one is only ever lost by addition, and always for a good reason: one font from a CDN, one script to find out whether a page is slow. Each is a request naming her record's address, made to someone else's log, on a page reachable only by her. The absence has to be a rule, because each individual addition will look reasonable.              | Everything it serves, it holds: fonts, styles, scripts and icons are local. No analytics, no error reporting, no remote fonts, no third-party anything — not reduced, absent.                                                                                                     |
| **DPV-005** | Nothing between her and the record keeps a copy.                                          | A default that is right for a public page is wrong here, and nothing fails visibly when it is wrong — the page still renders, and a copy of her record simply exists somewhere she has never been. Routes serving non-text personal bytes are where this is most often forgotten, because they look like assets.                                        | Every gated response is marked private and revalidated, so no shared cache, proxy or CDN may store it. Caching is the browser's own, and only for as long as the thing it holds is unchanged.                                                                                     |
| **DPV-006** | What the browser keeps is never the record.                                               | The failure is a convenience: caching a view locally so it opens faster leaves the record on a device with no gate in front of it, readable by anything else that can run script there. A preference lost is an inconvenience; a preference is also the only thing that may be lost, and that is what makes the storage safe to have at all.             | Client storage holds presentation preferences only — how the surface should look and behave. Nothing read out of the record is written to it, and nothing in it is needed to render the record correctly.                                                                          |
| **DPV-007** | A wrong password costs time, never entry. | A lockout is the usual answer to a guessing run, and here it shuts the person out of their own safety plan on the night they reach for it. The attack worth defending is volume against a generated secret, which a delay defeats as surely as a lock. Compliance is judged by whether the right credential, after any run of wrong ones, is answered at once. | Answer every attempt, and grow the delay with consecutive failures, capped at seconds and cleared on success. Falls short where the count lives in one process’s memory, so a restart clears it, and where one counter means a guesser’s run slows the person’s own sign-in too. |
| **DPV-008** | The human interface layer runs on the owner’s machine unless the owner chooses otherwise. | The owner’s own machine is the one place the layer is reachable by no one else. Hosted, it puts the record behind an address anyone on the internet can reach, with one password in the way, and adds a company holding a copy. That trade is the owner’s to make. Compliance is judged by whether the layer runs anywhere else without the owner having chosen it. | Run it bound to localhost with no deployment configuration for any host, and add one only on the owner’s word. Falls short of who else may reach it: a tunnel serves from the owner’s machine but through someone else’s, so that case stays under Unwritten. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../REFERENCES.md).

---

## Unwritten

This specification is incomplete. Per MNT-008, an empty spec gets written retroactively by whatever happens to get built — so these are the questions this file still owes an answer to:

- Whether the surface may ever be reached from a device that is not hers, and what changes if it is.
- What the surface may record about its own use — request logs, error traces — and for how long.
- What holds when the surface is reached over a network that is not local: the tunnel case, which is neither localhost nor the hosted deployment.
