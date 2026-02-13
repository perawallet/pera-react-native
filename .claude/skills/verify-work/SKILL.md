---
description: Run pre-completion verification checks
---

# Verify Work

Run this before reporting any task as complete.

## Steps

### 1. Run Pre-Push Checks

Runs linting, formatting, copyright, and i18n checks:

```sh
pnpm pre-push --no-fail-on-error
```

Fix any issues before proceeding.

### 2. Run Tests

```sh
pnpm test
```

Fix any failing tests.

### 3. Build Check (for major changes)

```sh
pnpm build
```

## All Checks Must Pass

Work is NOT complete until all checks pass. If any check fails:
1. Fix the underlying issue
2. Re-run all checks
3. Only then report completion

## Individual Commands (if needed)

```sh
pnpm lint           # Check for linting errors
pnpm lint:fix       # Auto-fix linting issues
pnpm format         # Format code
pnpm lint:copyright # Validate/add copyright headers
pnpm lint:i18n      # Validate i18n strings
```
