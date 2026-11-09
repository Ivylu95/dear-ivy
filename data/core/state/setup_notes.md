# Setup notes

- open · 2026-11-07 · routine missing: reminders are live but no hourly routine has run, so nothing reaches Telegram (setup-doctor `routine: missing`)
- open · 2026-11-09 · seven session branches' sent-log saves (reminders-sent, check-ins-sent) merged into local main as a union, but pre-push refuses two of the merges (33lng3, c5biug): its line test counts superseded counter lines ("sent": 1, older "last") as lost. Local main is 15 ahead and unpushed; record saves go to main from a worktree of origin/main meanwhile
