# Documentation Standards

Documentation lives in three places, split by audience and by how it gets loaded.

| Location          | Audience              | Shape                                          |
| ----------------- | --------------------- | ---------------------------------------------- |
| `docs/`           | Humans, on demand     | Overviews and decision records                 |
| `CLAUDE.md`       | Agents, every session | Dense, actionable rules with key examples      |
| `.claude/skills/` | Agents, on demand     | Step-by-step procedures invoked via `/command` |

Naming: `docs/` uses `SCREAMING_SNAKE_CASE.md`, `.claude/skills/` uses kebab-case directories.

## The rule

**Record the decision and the reason, never the journey.** Nothing here carries a ticket, milestone
or task reference, a description of what a PR changed, or a status that expires. Those are
unlookupable or wrong within months, and they train readers to skim.

**A doc must earn its place against the code.** Before writing one, check whether the fact belongs in
a JSDoc beside the thing it describes; that is where a reader will look, and it cannot drift from the
code it sits on. A `docs/` file is for what spans files, records a decision, or concerns something
outside the repo entirely — an external contract, a third-party service, an ops procedure.

If a doc and a module doc both explain something, one is the source and the other links to it.

## Enforcement

`pnpm lint:docs` (`tools/check-doc-hygiene.mjs`, part of pre-push) fails on work-item references,
dead links and paths that are not in the repo, and reports over-long `docs/` files without failing.
Record a genuine exception with its reason on the line above:

```
<!-- doc-hygiene-ignore-next-line stale-path reason: written by CI at build time -->
```

The `writing-docs` skill carries the full guidance, with worked examples.
