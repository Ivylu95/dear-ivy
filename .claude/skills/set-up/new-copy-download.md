# A new copy, steps 3 to 7

**Read when** a new copy reaches step 3, after [`new-copy.md`](new-copy.md)'s steps 1 and 2, or for one part's step among them (`components.md`). `new-copy.md`'s opening holds here too: every account theirs, signed in as them, three identities, placeholders, the nevers, and what each step says. Until step 12, whoever is typing is setting it up, and is asked no profile question; an open case in `cases.md` is warned of before its step.

**Where:** every step here is on **their** computer, in its terminal (Git Bash on Windows, Terminal on macOS); steps 4 to 7 use no network. Never: gitignore `data/` (it is the memory) · host the dashboard (localhost only) · leave a token in a remote URL · open a pull request or protect `main`.

### 3 to 5. Download, cut the history, empty the record

The README's download starts with a clone, by the command the README gives, with the helper's read token. A *clone* is a copy of a repository on this computer, and a read token is a one-purpose password that can only read. Then the person runs `node ux/scripts/new-copy.mjs --go` in their own terminal, inside the folder the clone made. It asks who the copy is for (or `--for me`, `--for someone-else`). It removes the clone's history (the read token with it) and the source's record, and lays a blank record. Then it starts `main` with the commit gate on, the check every save passes before it is kept. For someone else it removes `dev/` too (`DEP-013`), and writes the answer in the setup notes, where the doctor flags a `dev/` that comes back. **The agent never runs it**: it removes a record, and it refuses inside a Claude session. A folder opened before it ran holds the source's record, so read none of it. The person runs it, revokes the token, and opens a new session. Stopped part-way, it says what next: run it again, or delete the folder and clone again. It refuses a clone holding work on no remote: a stash, an unpushed commit (a detached one included), ignored files under `data/`, or a second working folder. Push or move them first. It also refuses a leftover `temp/new-copy`, so delete it and run again. The copy's `FEEDBACK.md` starts empty.

**You should see** `Done: a new copy`, the brief's *NEW COPY* when Claude Code is next opened in that folder, and `data/core/me/about_me.md` still marked `unfilled:`. That mark makes her first session a first contact. Leave it, unless an import removes it (`import-finish.md` step 5).

**If not:** the command prints what it refused and why; do what it names, then run it again. *Cannot find module*: the terminal is not inside the cloned folder (`cd` into it first). The clone itself refused (*Repository not found*): the read token, not the privacy (`repair-push.md`).

### 6. Leave the profile to them

Nothing is written: their name, pronouns and timezone are their own answers, asked by `first-contact` in the first conversation (step 12), never filled by the helper. The country is already in the setup notes (`new-copy-run.md`). Run `npm --prefix ux install`, then `npm --prefix ux run check`. The install fetches the tools the checks use, and a session start runs it in the background. Run it by hand when the check says js-yaml is missing, unless `temp/install-deps.lock` is under 15 minutes old. Then wait for that run instead. If npm is blocked, set up on another computer.

**You should see** `data/PROFILE.yaml` still unasked, and the check pass.

**If not:** the check names each fault and its file; a fault in a file the download laid is a case (`running.md`), never an edit to pass it.

### 7. Their own crisis numbers

Copy her country's entry from `modules/core/knowledge/crisis-lines.md` into the four number lines of `data/safety/safety_plan.md`, by role, with the checked date; Singapore's are already there. No entry, no setup (`new-copy-run.md`, `SAF-016`). One of the two steps invisible when missed: never passed on a setting alone, judged against the recorded country. The agent makes this edit; the person need do nothing.

**You should see** the doctor's `safety-plan` ✅, never `failed`.

**If not:** on `failed` or `broken`, compare the `- country ·` line in the setup notes with the catalogue entry copied, each of the four roles in its place. A country with no checked entry stops the setup until the developer adds it (`new-copy-run.md`).

Then [`new-copy-finish.md`](new-copy-finish.md), steps 8 to 11.
