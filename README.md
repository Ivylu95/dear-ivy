# dear

> [!IMPORTANT]
> **Safety and privacy come first. Everything else comes second.**
>
> Safety and privacy are the working principles of this repository, not features
> of it. Every feature, however useful or appealing, takes second place to them:
> if a new feature would make this less safe or less private, it does not go in.
>
> Both are reviewed regularly against current best practice, so this tool can be
> used safely and privately, and features are built on top of that foundation,
> never in place of it. How each is kept: [safety policy](policies/SAFETY_POLICY.md)
> and [privacy policy](policies/PRIVACY_POLICY.md).
>
> **Privacy, without exception:** everything personal lives in `data/`, and nothing
> outside it is. Take `data/` away and the rest can be handed to anyone: it tells them
> nothing about who used it, not a name, a place, a date or a word of theirs. Whatever
> is written outside `data/` is checked before it lands, before it is saved, and before
> anything leaves, and the whole tree is read for it twice a day.

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
the whole answer. To move to new machinery, copy that folder and nothing else.

**Nothing is ever deleted by the system.** If it tidies something, the old
version moves to `data/archive/`. You can always go back.

### Privacy is a core function, not a setting

A space you think out loud in is only safe if you can know, without trusting
anyone's judgement, exactly where every word went. So the rule is mechanical:
inside `data/` is personal, outside it nothing is, and checks prove it on every
edit and every turn rather than hoping. It is also what makes the record yours
to keep: one folder to see, back up, move or remove.

**Read the [privacy policy](policies/PRIVACY_POLICY.md)** for what that
promises, how it is enforced, and where it honestly stops (git history, the
chat service, the repository's own name).

### Safety comes before every feature

If you are not safe, everything else stops. This is not a therapist or a crisis
service, and it will say so and point you to a person rather than pretend
otherwise. Its crisis response is always loaded, never optional, and deliberately
quick to trigger. Every change to the system is checked for what it could do to
someone in a bad moment before it is allowed in, and a feature that would weaken
the crisis response is the one that changes.

**Read the [safety policy](policies/SAFETY_POLICY.md)** for what it promises, the
safety-first process every change goes through, and where it stops.

**Read the [terms of use](policies/TERMS_OF_USE.md)** before using it or setting
it up for anyone: who may use it (adults only), what it is not, and the limits
of the maker's responsibility.

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
.github/            the workflow that merges session branches into main
CLAUDE.md           the system — persona, safety, the crisis block, the
                    router. Read every session.
.claude/            the harness. Generic, no personal content, ever.
  skills/           one skill per session type — first-contact,
                    something-happened, pattern-work, a-person, bright-spots,
                    journal, looking-back. A module's skills live inside the
                    module and load as a plugin, `<module>:<skill>`.
                    Loaded on demand, not every session. Crisis is NOT a skill
                    — see The immutable core. Blank shapes are not kept
                    here: they live in modules/core/templates/<skill>/
  commands/         operator-invoked procedures
  settings.json     permissions and lifecycle hooks — the enforcement layer
  THRESHOLDS.md     every number past which the system acts, in one table.
                    Generated from the spec rows: read it here, change it there
modules/            one self-contained layer per area of life: core/, always on,
                    and optional ones like therapy/, each with its skills,
                    blank shapes, evidence and router rows. See modules/README.md
.claude-plugin/     generated: the local marketplace that loads each module's
                    skills. Written by `npm run modules`, never by hand
data-sample/        an invented record, nobody's, so the dashboard can be
                    looked at with a record in it
data-sandbox/       a blank test record that tests may write to, so the
                    sample is never written by a test
data/               all personal content. Nothing personal exists outside it.
                    The root is the harness's (PROFILE.yaml, safety/, archive/);
                    each module keeps its own folder: data/core/, data/therapy/
policies/           what the system promises the person, in plain words —
                    PRIVACY_POLICY.md, SAFETY_POLICY.md (with its hazard log),
                    TERMS_OF_USE.md. Written for the person; held to
                    dev/specs/legal/policies.md by npm run check.
dev/specs/              what must hold and why — the design the harness is judged
                    against. Outside .claude/: not configuration (ARC-005).
ux/                 the dashboard — a read surface over data/. Self-contained;
                    the repository is the record, this is one thing built on it.
```

**Every threshold the system enforces** — how old scratch gets before it is
swept, how large before it is reported, and the rest — is in one table:
[`.claude/THRESHOLDS.md`](.claude/THRESHOLDS.md).

### How a session runs

```
read data/core/state/now.md  ──▶  check in  ──▶  dispatch to a skill
        │                                            │
        └── ~30 lines, rewritten every close ──▶ write · index · commit
```

Two files are read every session: `CLAUDE.md` and `data/core/state/now.md` — the
skills load only when one matches. Anything
else is fetched via `data/README.md`, never by sweeping the repo. That's what
keeps it viable after a year of daily use.

### Retrieval

Every file in `data/` carries front-matter (`date · type · people · tags ·
mood`), dated filenames, and a controlled tag vocabulary. `data/README.md` maps
the lot — one line per file. Retrieval order is fixed: `now.md` → `README.md` →
the two or three files it points at.

### Self-sustaining

Upkeep runs **silently** every 8 sessions or 3 weeks — dedupe, consolidate,
repair broken references, rebuild the index. Never mid-session, never as a
request, never after a crisis session. What must hold of it is specified in
`dev/specs/system/maintenance.md` (**MNT-001**, **MNT-002**); the triggers
are tracked in `data/core/state/log.md`.

The rule that makes unsupervised editing safe: **nothing is ever deleted.**
Superseded material moves to `data/archive/` with a note saying where it came
from. Anything the system thinks should truly go is left alone and raised with the
developer instead.

### Self-updating

Every 8 weeks it searches for current evidence on therapeutic practice and
on agent-system design, then amends itself — **one change per run**, each
traceable to a real citation, committed separately so it can be reverted
(`dev/specs/system/maintenance.md`, **MNT-003**–**MNT-007**).

It searches **blind**: the log is opened only *after* the search, so a run is
never primed to confirm its own last answer.

It then **watches the next three sessions**. If a change makes things worse, it
reverts and records why in `modules/core/knowledge/log.md` → *Tried and reverted*.

### The immutable core

Research may only ever **strengthen** these — never soften, shorten or remove:

- Safety, and crisis handling — both kept in `CLAUDE.md` itself, and **never
  made a skill**: a skill loads only if its description matches, and a floor
  that depends on a dispatch decision is a floor that a missed match removes
- the helpline numbers
- "nothing is ever deleted"
- the limits on what the system is not licensed to do (`CLAUDE.md` →
  *Operating Procedures* → *When she wants… something you aren't*) — no
  structured therapy protocols, no trauma processing, no clinical work the
  person's own clinician hasn't sanctioned
- the rule that says all of the above is immutable

A system that can rewrite its own instructions needs a floor it cannot reach.
That's the floor.

### Grounding

`CLAUDE.md` → *Operating Procedures* → *When you're about to… give
advice* names the practice it works from — Stanley–Brown safety planning,
asking about suicide directly, motivational interviewing, behavioural
activation, validation before change, and the primacy of the therapeutic
alliance over technique. The maintained, cited version is
`modules/core/knowledge/practices.md`; each row carries its source, its evidence tier, and
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
`dev/specs/ux/purpose.md`.

**Deployed, the record leaves the machine.** A hosted deployment puts `data/` on
a third party's servers and through its build pipeline and logs. The login gate
stops strangers; it does not stop the platform. Localhost only is the safer
posture, and the app runs there unchanged.

---

## Operating notes

- **`data/` must be committed. Do not gitignore it.** It *is* the memory —
  unignored is the point. Privacy comes from the repository being **private and
  single-member**, not from holding files out of git. The one exception is
  `data/archive-local/`: archived raw material the developer chose to keep on the machine,
  never anything the record depends on. Its README says what it holds.
- **Commit to the default branch; never open pull requests.** A user who has to
  approve a diff to save a journal entry will not save journal entries.
- **Test on `data-sandbox/`, never on `data/`.** In development mode, type
  `/dev-mode sandbox` and that chat alone uses a blank record with `data/`'s shape,
  answering as she would see it; every other chat stays on the real one
  (WKB-013). `/dev-mode sandbox off` switches back to development mode,
  `/dev-mode sandbox reset` blanks it again, and `/dev-mode sandbox sample` fills it with a copy
  of the invented record in `data-sample/`, to try things on a full record
  without touching the showcase (SMP-008). The switch is saved with the sandbox, so a
  resumed chat stays where it was. Delete `data-sandbox/` whenever you like;
  nothing else refers to it. Its blank shape is every module's `standing` files —
  `modules/core/templates/blank-record/` for the record itself — and `npm run check` fails
  when `data/` grows a kind of file that has no blank copy there.
- **Web access is required for a research run.** Without it, a run must log
  "no access, skipped" and change nothing. A run that invents a citation is
  worse than no run at all.

## Setting it up

Download it, run one command, then ask Claude to set it up. Everything after the
download is done in a conversation: the `set-up` skill checks what is already in
place, walks each step one at a time, and proves each one before the next.

You need, once: a GitHub account and a Claude account on a paid plan, both
belonging to the person it is for (someone else can pay; nobody else may be a
collaborator, **PRV-001**), their phone, and a computer with
[git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org) on it,
theirs and signed in as them. On Windows, run the commands in **Git Bash**.

**1. Download it**, somewhere no sync service watches (not OneDrive, Dropbox or
iCloud, which would hold the whole record in plain text):

```sh
git clone https://github.com/<owner>/<this repository>.git dear-<name>
cd dear-<name>
node ux/scripts/new-copy.mjs --go
```

This repository is private, so the clone asks for a read token from its owner:
[fine-grained](https://github.com/settings/personal-access-tokens/new), this
repository only, **Contents: Read-only**, 7 days, pasted as the password. The
third command takes the history and the record that came with the clone off it
(they belong to the copy it was cloned from, which keeps them) and lays a blank
record in their place; the token goes with the history, so revoke it now. It asks
who the copy is for: for someone else it also removes `dev/`, the developer's own
folder, which never ships to a person's copy. Run it
**before** Claude is opened in the folder: until then the folder holds that other
record, and a session started in it would read it. Without `--go` it only says
what it would do.

**You should see** `Done: a new copy for …, with a blank record and no history`.

**2. Open Claude Code in that folder and say "help me set it up."** It takes it
from there: their repository, the profile, the crisis numbers for where they
live, the first push, their phone, the first conversation and proof it saved, a
second copy, the check-in nudge and reminders on Telegram if they want them, and, if you set it up for
someone else, leaving no access behind. A step it cannot do (a click in GitHub,
anything on their phone) it describes exactly, then checks.

Stop at any point and say "where did we get to?" later: it reads where the copy
is from the copy itself. The steps it follows are in
[`.claude/skills/set-up/new-copy.md`](.claude/skills/set-up/new-copy.md),
[`new-copy-download.md`](.claude/skills/set-up/new-copy-download.md),
[`new-copy-finish.md`](.claude/skills/set-up/new-copy-finish.md)
and [`new-copy-close.md`](.claude/skills/set-up/new-copy-close.md)
(Telegram's in [`telegram.md`](.claude/skills/set-up/telegram.md) and
[`telegram-routine.md`](.claude/skills/set-up/telegram-routine.md) beside them),
readable without Claude.

## Updating someone's copy

A new version of the harness reaches other people's copies through two gates,
both the developer's, and then a third that is theirs:

1. **The release phrase.** In a development chat, ask to cut a release. The
   `release` skill builds what ships (everything named in its manifest; never
   `data/`, `dev/specs/` or the release tooling), checks it, runs it with `dev/specs/`
   removed, and prints a phrase such as `RELEASE v1.4 7F2K`. Type it exactly.
2. **GitHub's approval.** The release workflow waits for you on GitHub, behind
   your own login. On approval it signs the release and publishes it to the
   private release repository.
3. **Their typed phrase.** Send each person a read key for the release
   repository, expiring when you choose. They paste it into a chat on their copy.
   Their copy fetches the release, judges it with its own checks before any of it
   runs, and only then asks them to type a phrase such as
   `update to version 1.4 7F2K`. A copy that cannot prove the release is yours,
   whole, and harmless to its record holds it back, logs it, and says so.

The key is used for that one download and stored nowhere. Every update is one
commit, tagged before it lands, and "go back to the last version" undoes it. A
copy made before this existed takes one first-install message, printed by
`node dev/skills/release/release.mjs first-install <version>`. The whole flow,
its checks and its set-up are in [`dev/skills/release/`](dev/skills/release/SKILL.md).
