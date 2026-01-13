---
description: Verify that all work meets quality standards before completion
---

# Verify Work Workflow

Run this workflow before reporting any task as complete.

## Verification Steps

### 1. Format Code

// turbo

```sh
pnpm format
```

### 2. Check Linting

// turbo

```sh
pnpm lint
```

If errors occur, fix them (do not disable rules).

### 3. Check Copyright Headers

// turbo

```sh
pnpm lint:copyright
```

### 4. Run Tests

// turbo

```sh
pnpm test
```

If tests fail, debug and fix them.

### 5. Build Check (Optional)

For significant changes:

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
