# Repair: a save or a push refused

**Read when** a save or a push did not reach GitHub (`SKILL.md` § 3). That covers a push-failed note in the record, a lock git left behind, a file too big, or a push refused at a new copy's step 8. Start from the doctor and finish on it, as [`repair.md`](repair.md) does: done when the part reads ✅. In her own chat, the answer is `her-side.md`'s.

| What is seen | Part | What separates it from its neighbour |
|---|---|---|
| `PUSH_FAILED.md` in the record (`push`) | The save | The note names the cause; a `rescue/` branch named in it holds the work. The note alone is not a record change: a branch holding only it carries nothing to keep |
| A save refused with `.git/index.lock` (*File exists*), no git still running | The save | A lock a stopped git left: the person removes `.git/index.lock` by hand (the agent's history guard refuses): in the copy's folder, in its terminal, `rm .git/index.lock` (`.git` is a hidden folder, so a file browser may not show it), then the doctor. **You should see** the doctor's `lock` no longer broken, and the next save land |
| A push refused for a file over GitHub's 100 MB limit | The save | Every later save fails until the file leaves the commits not yet on GitHub. The developer's step, never the agent's: undo only those commits, keeping their changes (`git reset --soft origin/main`), move the file to the git-ignored `data/archive-local/` (kept on that machine only), commit and push again; pushed history is never rewritten. **You should see** `main -> main` and the doctor's `push` ✅ |

**A push that failed: retry it once, then run the doctor.** The save hook clears the note once one lands. If it still fails, stop retrying, and never force it. The save is safe on its branch, not yet on main. Say so plainly, with what would carry it (`SKILL.md` § 6), and write its dated case.

## When a push is refused at a new copy's step 8

| What git says | What it is |
|---|---|
| `denied to <helper>` · `403` | The push ran as the helper: their login is cached |
| `rejected … fetch first` | Their repository was not empty at step 1 |
| `Repository not found` at the clone | The read token, not the privacy |
| `Repository not found` at the push | Created under another account at step 1: check the URL's owner |

**Fetch first:** their repository holds nothing worth keeping, so the person runs `git push -u origin main --force` themselves (the agent never forces), in the copy's folder on their computer. **You should see** `main -> main` marked as a forced update, and their GitHub showing the one commit with `data/` in it. **Denied:** on Windows, in Command Prompt or PowerShell (Git Bash rewrites `/delete:`), run `cmdkey /delete:git:https://github.com` (find it with `cmdkey /list`) and `git config --global credential.https://github.com.username <them>`. On macOS, open Keychain Access → `github.com` → delete. Then push again, signed in as them. Git asks for a sign-in again, because the cached one, a *credential*, is gone. **You should see** `main -> main`. If it is still the helper, put a write token of **theirs** (Contents: Read and write, that repository) in the push URL once. They make it on their GitHub's token settings page, its path fetched now (`running.md`). Afterwards, run `git remote set-url origin` back to the clean URL, then revoke the token.
