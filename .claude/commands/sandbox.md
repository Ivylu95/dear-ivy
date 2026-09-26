---
description: Switch this chat to the blank test record in data-sandbox/, or back. `/sandbox` on, `/sandbox off`, `/sandbox reset`.
argument-hint: "[off | reset]"
---

Run exactly one command, from the repository root, choosing the action from the
argument: none → `on`, `off` → `off`, `reset` → `reset`.

```
node ux/scripts/sandbox.mjs <on|off|reset>
```

Then commit and push `data-sandbox/` on the current branch (`record: sandbox <action>`),
so the switch survives this machine being reclaimed.

Then reply with the script's one line and nothing else — no summary, no
explanation. If the action was `on` or `reset`, add a second line: "Say hi to
start the test." If the script failed, say plainly that nothing was switched and
show its message.

From the next message on, the per-message reminder decides which record this chat
uses. `data/` is never read or written while the sandbox is on.
