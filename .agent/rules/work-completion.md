---
trigger: always_on
---

# Work Completion Standards

Before considering ANY task complete, you MUST verify the following acceptance criteria:

## Pre-Completion Checklist

### 1. Run Pre-Push Checks

Run the unified verification command:

```sh
pnpm pre-push
```

This single command runs:
- ESLint (linting)
- Prettier (formatting)
- Copyright header validation
- i18n validation

### 2. Run Tests

```sh
pnpm test
```

### 3. Specific Package Checks (Optional)

If you modified code in a specific workspace:

```sh
# For mobile app
pnpm --filter mobile test
pnpm --filter mobile lint

# For packages
pnpm --filter [package-name] test
pnpm --filter [package-name] lint
```

### 4. TypeScript Compilation (For Major Changes)

For significant changes, ensure TypeScript compiles:

```sh
pnpm build
```

## Work Is NOT Complete Until

- [ ] `pnpm pre-push` passes (lint, format, copyright, i18n)
- [ ] `pnpm test` passes (all tests green)
- [ ] Any new files follow naming conventions from `docs/NAMING_CONVENTIONS.md`
- [ ] Any new code follows patterns from `docs/STYLE_GUIDE.md`
- [ ] Tests are written for new functionality per `docs/TESTING.md`

## If Checks Fail

1. **Linting errors**: Run `pnpm lint:fix` to auto-fix, then fix remaining manually
2. **Formatting issues**: Run `pnpm format` to auto-fix
3. **Copyright errors**: Run `pnpm lint:copyright` to add headers
4. **Test failures**: Debug and fix the failing tests
5. **Build errors**: Resolve TypeScript errors

## Reporting Completion

When reporting task completion to the user, include:

1. Summary of changes made
2. Confirmation that `pnpm pre-push` and `pnpm test` pass
3. Any notable design decisions or trade-offs
