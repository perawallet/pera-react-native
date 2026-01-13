---
trigger: always_on
---

# Work Completion Standards

Before considering ANY task complete, you MUST verify the following acceptance criteria:

## Pre-Completion Checklist

### 1. Code Quality Checks

Run these commands and ensure they pass:

```sh
# Check for linting errors
pnpm lint

# Check formatting
pnpm format

# Check copyright headers
pnpm lint:copyright

# Run tests
pnpm test
```

### 2. Specific Package Checks

If you modified code in a specific workspace:

```sh
# For mobile app
pnpm --filter mobile test
pnpm --filter mobile lint

# For packages
pnpm --filter [package-name] test
pnpm --filter [package-name] lint
```

### 3. TypeScript Compilation

Ensure TypeScript compiles without errors:

```sh
pnpm build
```

## Work Is NOT Complete Until

- [ ] All linting errors are resolved (`pnpm lint` passes)
- [ ] All tests pass (`pnpm test` passes)
- [ ] Code is properly formatted (`pnpm format` applied)
- [ ] Copyright headers are present (`pnpm lint:copyright` passes)
- [ ] TypeScript compiles successfully (`pnpm build` passes)
- [ ] Any new files follow naming conventions from `docs/NAMING_CONVENTIONS.md`
- [ ] Any new code follows patterns from `docs/STYLE_GUIDE.md`
- [ ] Tests are written for new functionality per `docs/TESTING.md`

## If Checks Fail

1. **Linting errors**: Fix the issues, don't disable rules
2. **Test failures**: Debug and fix the failing tests
3. **Build errors**: Resolve TypeScript errors
4. **Format issues**: Run `pnpm format` to auto-fix

## Reporting Completion

When reporting task completion to the user, include:

1. Summary of changes made
2. Confirmation that all checks pass
3. Any notable design decisions or trade-offs
