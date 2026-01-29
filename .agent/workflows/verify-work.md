---
description: Verify that all work meets quality standards before completion
---

# Verify Work Workflow

Run this workflow before reporting any task as complete.

## Verification Steps

### 1. Run Pre-Push Checks

This is the primary verification command that runs linting, formatting, copyright, and i18n checks:

// turbo

```sh
pnpm pre-push --no-fail-on-error
```

If this fails, fix the issues before proceeding.

### 2. Run Tests

// turbo

```sh
pnpm test
```

If tests fail, debug and fix them.

### 3. Build Check (For Major Changes)

For significant changes, verify TypeScript compiles:

// turbo

```sh
pnpm build
```

## All Checks Must Pass

Work is NOT complete until ALL checks pass without errors.

If any check fails:

1. Fix the underlying issue
2. Re-run all checks
3. Only then report completion

## Individual Commands (If Needed)

If you need to run checks individually:

```sh
pnpm lint           # Check for linting errors
pnpm lint:fix       # Auto-fix linting issues
pnpm format         # Format code
pnpm lint:copyright # Validate/add copyright headers
pnpm lint:i18n      # Validate i18n strings
```