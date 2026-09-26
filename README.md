# dear

A private, file-based therapy companion. One person talks to it; it listens,
remembers, organises the record for them, keeps itself tidy, and periodically
checks its own practice against current research.

It is **not a therapist** and does not diagnose. It's a place to think, and a
record that holds everything so the person using it doesn't have to.

---

## If you are the person using it

You just talk. Open a chat and say anything — even "hi".

It reads what you said last week before it answers. It decides what kind of
conversation this is. It writes down what matters, in the right place. It tidies
itself up when things get messy. You never file anything, organise anything, or
approve anything.

**Everything about you lives in `data/`.** Nothing personal is anywhere else —
so if you ever want to know exactly what's kept about you, that one folder is
the whole answer. Delete it and it's gone.

**Nothing is ever deleted by the system.** If it tidies something, the old
version moves to `data/archive/`. You can always go back.

**If you're in crisis, don't use this — call someone.**
**SOS 1767** (24h) · **CareText 9151 1767** (WhatsApp) ·
**mindline 1771** (24h) · **Emergency 995**

---

## If you are reading the code

### Design

Three layers, split so the machinery can be replaced without touching the
record. Everything generic lives under `.claude/`; everything personal lives
under `data/`; the dashboard is a read surface over the second.

```
.claude/            the harness. Generic, no personal content, ever.
  CLAUDE.md         the system — persona, safety, the crisis block, the
                    router. Read every session. Capped at 450 lines.
  skills/           one skill per session type — check-in, first-contact,
                    after-therapy, something-happened, pattern-work,
                    a-person, bright-spots, journal, looking-back. Loaded on
                    demand, not every session. Crisis is NOT a skill — see The
                    immutable core. Each skill carries its own blank shapes in
                    a templates/ folder beside its SKILL.md
  commands/         operator-invoked procedures
  settings.json     permissions and lifecycle hooks — the enforcement layer
data/               all personal content. Nothing personal exists outside it.
knowledge/          the evidence base, and the tracker for keeping it current
specs/              what must hold and why — the design the harness is judged
                    against. Outside .claude/: not configuration (ARC-008).
ux/                 the dashboard — a read surface over data/. Self-contained;
                    the repository is the record, this is one thing built on it.
```

### How a session runs

```
read data/state/now.md  ──▶  check in  ──▶  dispatch to a skill
        │                                            │
        └── ~30 lines, rewritten every close ──▶ write · index · commit
```

Two files are read every session: `.claude/CLAUDE.md` and `data/state/now.md` — the
skills load only when one matches. Anything
else is fetched via `data/INDEX.md`, never by sweeping the repo. That's what
keeps it viable after a year of daily use.

### Retrieval

Every file in `data/` carries front-matter (`date · type · people · tags ·
mood`), dated filenames, and a controlled tag vocabulary. `data/INDEX.md` maps
the lot — one line per file. Retrieval order is fixed: `now.md` → `INDEX.md` →
the two or three files it points at.

### Self-sustaining

Upkeep runs **silently** every 8 sessions or 3 weeks — dedupe, consolidate,
repair broken references, rebuild the index. Never mid-session, never as a
request, never after a crisis session. What must hold of it is specified in
`specs/system/maintenance.md` (**MNT-001**, **MNT-002**); the triggers
are tracked in `data/state/log.md`.

The rule that makes unsupervised editing safe: **nothing is ever deleted.**
Superseded material moves to `data/archive/` with a note saying where it came
from. Anything the system thinks should truly go is left alone and raised in
`data/state/proposals.md` instead.

### Self-updating

Every 8 weeks it searches for current evidence on therapeutic practice and
on agent-system design, then amends itself — **one change per run**, each
traceable to a real citation, committed separately so it can be reverted
(`specs/system/maintenance.md`, **MNT-003**–**MNT-007**).

It searches **blind**: the log is opened only *after* the search, so a run is
never primed to confirm its own last answer.

It then **watches the next three sessions**. If a change makes things worse, it
reverts and records why in `knowledge/log.md` → *Tried and reverted*.

### The immutable core

Research may only ever **strengthen** these — never soften, shorten or remove:

- Safety, and crisis handling — both kept in `.claude/CLAUDE.md` itself, and **never
  made a skill**: a skill loads only if its description matches, and a floor
  that depends on a dispatch decision is a floor that a missed match removes
- the helpline numbers
- "nothing is ever deleted"
- the limits on what the system is not licensed to do (`.claude/CLAUDE.md` →
  *Operating Procedures* → *When she wants… something you aren't*) — no
  structured therapy protocols, no trauma processing, no clinical work the
  person's own clinician hasn't sanctioned
- the rule that says all of the above is immutable

A system that can rewrite its own instructions needs a floor it cannot reach.
That's the floor.

### Grounding

`.claude/CLAUDE.md` → *Operating Procedures* → *When you're about to… give
advice* names the practice it works from — Stanley–Brown safety planning,
asking about suicide directly, motivational interviewing, behavioural
activation, validation before change, and the primacy of the therapeutic
alliance over technique. The maintained, cited version is
`knowledge/practices.md`; each row carries its source, its evidence tier, and
whether the source was actually opened and read or only its record reached.

---

## The dashboard

A small Next.js app in `ux/` that renders `data/` as a private
website. It **reads only** — the record has one writer, and that is the
conversation.

It lives entirely in `ux/`, so the repository root stays the record rather than
a web app with a record inside it.

```
cd ux
npm install
npm run dev        # http://127.0.0.1:3220
```

The first run writes `.env` at the REPOSITORY ROOT — beside `data/`, not inside
`ux/` — with a generated password, and prints it once. Who may open this record
is a property of the record, not of the app that displays it, which is why it
lives there. Next only auto-loads `.env` files from `ux/`, so `ux/config/env.mjs`
reads this one and fills in anything the environment does not already carry; on
a hosted deployment the variables come from the platform and there is no file at
all. It is gitignored; nothing it holds reaches the repository.

`data/` sits one level ABOVE the app, which is the one thing to know if you move
any of this again. `ux/lib/content-read.js` resolves it by looking one directory up,
then in the working directory, with `DEAR_DATA` overriding both, and
`ux/next.config.mjs` raises the file-tracing root to the repository so a
deployment actually packages the markdown. Miss the second and the build still succeeds — it just serves an empty
record.

Everything is gated: `proxy.js` refuses every route without a signed session
cookie, and fails closed if no credentials are configured. Deployed, the same
variables become project environment variables — and changing one there needs a
redeploy, not just an edit.

Two rules the app is built around, both enforced in code rather than only
described:

- **It never counts her.** No streaks, no entries-this-month, no days-since.
  Every number a record like this could produce is a number that invites
  comparison with last week's, and that turns something she is free to ignore
  into something she is failing. The only counts anywhere are of things on file —
  how many people, how many open threads — and they live in the nav.
- **Red is for one thing.** The `alert` colour has a single caller: the crisis
  numbers on `/safety`, which are read out of `data/safety/safety_plan.md` rather than
  written into the code. Nothing about how she is doing is ever painted in it.

Deploying it: set the project's **root directory to `ux`** and enable including
files from outside it, or the record will not be there to read.

The full reasoning, and what was deliberately not built, is in
`specs/ux/purpose.md`.

**Deployed, the record leaves the machine.** A hosted deployment puts `data/` on
a third party's servers and through its build pipeline and logs. The login gate
stops strangers; it does not stop the platform. Localhost only is the safer
posture, and the app runs there unchanged.

---

## Operating notes

- **`data/` must be committed. Do not gitignore it.** It *is* the memory —
  unignored is the point. Privacy comes from the repository being **private and
  single-member**, not from holding files out of git.
- **Commit to the default branch; never open pull requests.** A user who has to
  approve a diff to save a journal entry will not save journal entries.
- **Test on `data-sandbox/`, never on `data/`.** Type `/sandbox` as the first
  message of a chat and that chat alone uses a blank record with `data/`'s shape;
  every other chat stays on the real one. `/sandbox off` switches back,
  `/sandbox reset` blanks it again. The switch is saved with the sandbox, so a
  resumed chat stays where it was. Delete `data-sandbox/` whenever you like;
  nothing else refers to it. Its blank shape is `.claude/templates/record/`, and
  `npm run check` fails when `data/` grows a kind of file that has no blank copy
  there.
- **Web access is required for a research run.** Without it, a run must log
  "no access, skipped" and change nothing. A run that invents a citation is
  worse than no run at all.

## Setting it up from scratch

The repository, the GitHub account and the Claude account must all be **theirs**.
Someone else can pay; nobody else should be a collaborator. A private repo with
one member is private — one with two members is not (`specs/data/access.md`,
**PRV-001**).

You need, once: a computer, their GitHub account, their Claude account on a paid
plan, and their phone. Everything after step 8 happens on the phone alone.

### 1. Make their repository

On **their** GitHub account, create a private repository — `dear-<name>` — with
no README, no `.gitignore`, no licence. Add no collaborators, not even yourself.

### 2. Put the system in it

From a computer, with this repository cloned:

```sh
git clone <this repository> dear-<name>
cd dear-<name>
git remote set-url origin https://github.com/<them>/dear-<name>.git
git push -u origin main
```

Cloning brings the whole history with it. If that history should not follow them,
delete the `.git` folder first and `git init` a fresh one, which costs the record
its past and keeps nothing personal that was ever committed.

### 3. Empty the record

`data/` is one person's and nothing in it transfers. Read every file under it and
clear anything real, leaving the structure and the blank shapes:

```sh
grep -rl 'unfilled:' data     # the files still waiting to be written
```

Each file that holds nothing yet carries an `unfilled:` marker. `data/me/about_me.md`
keeping its marker is what makes the first session a first contact rather than an
intake, so leave it there. Delete nothing else: the folders, the READMEs and
`data/INDEX.md` are the shape the system writes into. Fresh copies of each shape
live beside the skill that fills them, in `.claude/skills/*/templates/`.

### 4. Say who it is for

`data/profile.yaml` — their name, their pronouns, their timezone. The name is what
the dashboard calls them, and it is the only place it is written. Leave the four
essentials below them blank: the first conversation asks for each one, one at a
time, before anything else. Leave the name blank too if you'd rather it asked.

### 5. Put their own numbers in the safety plan

`data/safety/safety_plan.md` carries the crisis numbers, and `/safety` in the
dashboard reads them from there rather than from any code. The ones shipped are
Singapore's. **If they are somewhere else, change them now** — before the first
session, not after the first bad night.

### 6. Let Claude reach the repository

Install the [Claude GitHub App](https://github.com/apps/claude) on their account
and grant it that one repository. This is what lets a phone session clone it.

### 7. Let the saves reach `main`

A phone session can only push to its own branch, so a GitHub Action carries each
one into `main`. It needs write permission, which a new repository does not give
by default:

**Settings → Actions → General → Workflow permissions → Read and write permissions.**

Leave `main` unprotected, and add no required reviews: a save that waits for an
approval is a save that does not happen (`specs/system/deployment.md`,
**DEP-007**).

### 8. Commit and push everything above

```sh
git add -A && git commit -m "record: start a new record" && git push
```

### 9. Their phone

Install the **Claude** app, sign in to their account, open the **Code** tab, and
connect GitHub when asked. Accept the **Default** environment. Nothing else needs
configuring, and nothing needs installing on the phone again.

### 10. The first conversation

In the **Code** tab, start a session on their repository, on branch `main`, and
say anything — "hi" is enough. It cannot speak first: the platform needs their
message before it can answer, so the greeting comes second, not first.

### 11. Check it is actually saving

The one thing worth verifying, because a failure here is invisible from the
inside. After that first conversation:

```sh
git fetch origin && git log --oneline origin/main -3
```

Their first session's commit should be on `main` within seconds of the turn
ending. On GitHub, **Actions** should show a green `merge-sessions` run. If the
commit is sitting on the session's own branch instead, step 7 was missed.

Then open a **second** session and ask about something said in the first. If it
knows, the loop is closed: writes save themselves, and the next session starts
from them.

### 12. The second copy

The repository is one account with one provider, and gone with a lost login
(**DEP-001**). On their own computer:

```sh
git clone https://github.com/<them>/dear-<name>.git
```

Then have it pull on a schedule — Task Scheduler on Windows, `cron` or a
LaunchAgent elsewhere — so the copy stays current with nobody remembering to
update it. Encrypt that computer's disk; the clone is the whole record in plain
text.

### What not to do

- **Do not gitignore `data/`.** It is the memory. Privacy comes from the
  repository being private and single-member.
- **Do not add yourself as a collaborator**, however convenient it is for
  debugging. Debug against `samples/` instead, which exists for exactly that
  (`specs/data/sample.md`, **SMP-002**).
- **Do not host the dashboard.** Deployed, `data/` passes through a third party's
  build and logs. Localhost only.
- **Do not open pull requests**, and do not add a branch-protection rule that
  would force one.
