# A routed skill's test must state its route

**What happened (4 Nov).** see-it serves two people by route: hers by default, the developer's only
in development mode. Three scenarios written for his route never said development mode was on, so
the skill rightly took her route and the scenarios failed; another asked her steps be drawn but
held no steps. Both read as skill failures until the per-check grading was kept (`--write`).

**Do instead.** A scenario's situation states every fact the route depends on (the mode, what she
has already said), and a must the test harness cannot meet (publishing, a link) is worded as the
outcome it can see (built and ready to publish). Keep the grading on every live run, so a failure
says which check it missed. And one passing run is not proof: answers vary, so a scenario can flip
between runs; the scheduled re-check reruns them.

**Tell.** A routed skill failing only the cases of one route, with the other route's text loaded.
