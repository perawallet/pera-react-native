---
trigger: always_on
---

# Work Completion Standards

Before considering ANY task complete, you MUST verify the following acceptance criteria.

## Verification

Run the `/verify-work` workflow or execute these commands:

```sh
pnpm pre-push   # Lint, format, copyright, i18n
pnpm test       # Run all tests
```

## Work Is NOT Complete Until

- [ ] `pnpm pre-push` passes
- [ ] `pnpm test` passes
- [ ] New files follow conventions from `docs/NAMING_CONVENTIONS.md`
- [ ] New code follows patterns from `.agent/rules/code-patterns.md`
- [ ] Tests are written for new functionality

## Reporting Completion

When reporting task completion to the user, include:

1. Summary of changes made
2. Confirmation that `pnpm pre-push` and `pnpm test` pass
3. Any notable design decisions or trade-offs
