# Skill practice cache

_The values every skill is measured against, kept once with their sources
(`PMM-017`), each from published current practice, never chosen here. Read by
the skill check; refreshed when due (`PMM-005`, `PMM-006`). A value with no
source only warns, never refuses (`PMM-018`)._

**Last grounded:** 2026-10-13 · **Next due:** 2027-01-13 · **Interval:** 3 months

## Values

| Key | Value | Enforce | Source |
|---|---|---|---|
| description.maxChars | 1024 | refuse | [BP] "Maximum 1,024 characters" |
| description.listingCutChars | 1536 | warn | [CC] "truncated at 1,536 characters… Put the key use case first" |
| description.person | third | warn | [BP] "Always write in third person" |
| listing.budgetFraction | 0.01 | warn | [CC] budget "scales at 1% of the model's context window" |
| name.maxChars | 64 | refuse | [BP] "Maximum 64 characters" |
| main.maxLines | 500 | refuse | [BP] "Keep SKILL.md body under 500 lines" |
| main.maxTokens | 5000 | warn | [OV] Level 2 "Under 5k tokens" |
| reference.tocOverLines | 100 | warn | [BP] "longer than 100 lines, include a table of contents" |
| reference.maxDepth | 1 | refuse | [BP] "Keep references one level deep from SKILL.md" |
| reference.maxWords | none | — | [OV] "No practical limit on bundled content" |
| evals.minScenarios | 3 | warn | [BP] "At least three evaluations created" |
| evals.triggerQueries | 20 | warn | [SC] "Create 20 eval queries" |
| log.maxLines | 200 | warn | no source for skills; analogue [MEM] "first 200 lines of MEMORY.md" |
| wording.emphasis | reasons over caps | warn | [PE] "dial back any aggressive language" |

## Sources

- [BP] https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- [OV] https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- [CC] https://code.claude.com/docs/en/skills
- [SC] https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
- [MEM] https://code.claude.com/docs/en/memory
- [PE] https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

## Changes

- 2026-10-13 · First grounding, from the sources above. Replaced four values chosen without a source (a 300-character description cap among them).
