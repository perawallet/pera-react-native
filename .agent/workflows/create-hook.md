---
description: Create a new React hook following project conventions
---

# Create Hook Workflow

Use this workflow when creating a new hook.

## Prerequisites

Reference these before starting:

- `.agent/rules/code-patterns.md` - Detailed hook patterns with examples
- `docs/FOLDER_STRUCTURE.md` - Where to place the hook
- `docs/NAMING_CONVENTIONS.md` - Hook naming patterns

## Determine Hook Type

1. **Business logic hook** → `packages/[domain]/src/hooks/`
    - Data fetching, mutations, store access
2. **UI-specific hook** → `apps/mobile/src/hooks/`
    - Navigation, animations, clipboard, toast

## Steps for Business Logic Hook

### 1. Create Hook File

Create `packages/[domain]/src/hooks/use[Name].ts`

Follow patterns in `.agent/rules/code-patterns.md`:

- Query hooks: `use[Resource]Query` (e.g., `useAccountBalancesQuery`)
- Mutation hooks: `use[Action][Resource]` (e.g., `useCreateAccount`)
- Store hooks: `use[Resource]` (e.g., `useAllAccounts`)

### 2. Add to Index

Update `packages/[domain]/src/hooks/index.ts` to export the hook

### 3. Create Test

Create `packages/[domain]/src/hooks/__tests__/use[Name].test.ts`

Use Vitest with `@testing-library/react` for hook testing

### 4. Verify

// turbo

```sh
pnpm --filter [domain] test
```

// turbo

```sh
pnpm --filter [domain] lint
```

## Steps for UI Hook

### 1. Create Hook File

Create `apps/mobile/src/hooks/[name].ts`

### 2. Create Test

Create `apps/mobile/src/hooks/__tests__/[name].test.ts`

- Use Vitest with `@testing-library/react` (or `@test-utils/render` if providers like theme/queries are needed)

### 3. Verify

// turbo

```sh
pnpm --filter mobile test
```

// turbo

```sh
pnpm --filter mobile lint
```
