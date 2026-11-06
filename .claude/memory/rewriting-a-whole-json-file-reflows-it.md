# Rewriting a whole JSON file reflows it

**Seen twice.** `json.dump` of a hand-formatted file (`ux/lib/everyday-names.json` in late October; `dev/skills/set-up/evals.json` on 2026-11-04, 1,098 lines changed to edit two) rewrote its layout, burying the real change and inviting merge conflicts with every other chat.

**Do.** To change a value in a hand-formatted JSON file, replace the exact JSON-escaped string in the file's text (`json.dumps(old)[1:-1]` → `json.dumps(new)[1:-1]`, asserting it occurs once), then parse the result to prove it is still valid. Check `git diff --stat` shows only the lines meant before committing.
