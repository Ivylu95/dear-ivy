# When the push or the pull goes wrong

Read when a push is rejected or fails, the pull before it conflicts, or you commit on a branch that is not `main`. `SKILL.md`'s save rules hold throughout.

**Rejected because another session pushed first:** with nothing else uncommitted
in the tree, `git pull --no-rebase` and push once more. **Never a rebase**:
history is never rewritten.

**Clashing Transcript numbers no longer stop the pull:** its merge driver settles
two chats' clashes (`dev/dialogue/README.md`, *Two chats at once*); where it stops
anyway, `node ux/scripts/dialogue.mjs resolve`, then commit the merge.

**Leave other sessions' edits alone** (`SKILL.md`, step 4). **Never `--force`,
never a reset**; both throw away someone else's saved work.

**A merge that conflicts beyond the Transcript is settled**, or abandoned with
`git merge --abort` only if it is this session's own.

**Whenever it stops short, say plainly that the save has not reached the remote**,
and try again once the tree is clear. A tree that never clears leaves the save at
risk: a structural fault, raised with the developer, not worked around here.

| Trigger | Do | Because |
|---|---|---|
| The pull conflicts on a numbered file outside the Transcript (`E-0NN.md`, `dev/for-you.md`) | A card: `dialogue.mjs resolve`. A line: keep both, main's number stays, yours moves with your references | One side taken drops the other's work unseen (2026-10-26: E-069 and E-070 numbered twice) |
| The push fails with a 5xx or a reset, not a rejection | Nothing to pull: push again after 2, 4, 8, 16 s, then say the save has not landed | GitHub sometimes answers 500 to a push that lands a minute later |

**Push the branch you are on, as well as main** (`SKILL.md`, checklist 7), with
its upstream set once: `git push -u origin <branch>`. On a recovery or session
branch, `git push origin HEAD:main` saves the work, but the branch still reads
as unpushed. The platform's end-of-turn check then stops the turn and puts a
second copy of the reply in front of the person (2026-09-30).
