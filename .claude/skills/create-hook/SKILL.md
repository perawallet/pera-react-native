---
description: Create a new React hook following Pera conventions
---

# Create Hook

## 1. Identify Hook Type

| Type                 | Suffix         | When to Use                        |
| -------------------- | -------------- | ---------------------------------- |
| React Query (fetch)  | `Query`        | Fetching data from API             |
| React Query (mutate) | `Mutation`     | Creating, updating, deleting data  |
| Zustand Store        | `Store`        | Local application state management |
| Component Logic      | Component name | Extracting component/screen logic  |

## 2. Determine Location

| Scope                 | Location                                            |
| --------------------- | --------------------------------------------------- |
| Domain-level (shared) | `modules/[mod]/hooks/`                              |
| Cross-domain          | `modules/[originDomain]/hooks/` (export via barrel) |
| Screen-specific       | `modules/[mod]/screens/[Screen]/use[Screen].ts`     |
| Component-specific    | Same folder as the component                        |

## Steps for React Query Hook

1. Create hook file at `modules/[mod]/hooks/use[Name]Query.ts` or `use[Name]Mutation.ts`
2. Define explicit param and result types (never expose `UseQueryResult` / `UseMutationResult`)
3. Add to barrel file `modules/[mod]/hooks/index.ts`
4. Create test at `modules/[mod]/hooks/__tests__/use[Name]Query.spec.ts`

See `references/patterns.md` for query and mutation examples.

## Steps for Zustand Store Hook

1. Create hook file at `modules/[mod]/hooks/use[Name]Store.ts`
2. Use granular selectors, never destructure from `useStore()` directly
3. Add to barrel file
4. Create test

See `references/store-patterns.md` for store creation and access patterns.

## Steps for Component/Screen Logic Hook

1. Create hook file colocated with component:
    - `AccountCard/useAccountCard.ts`
    - `AccountScreen/useAccountScreen.ts`
2. Extract all complex logic (useState, useMemo, useCallback, data fetching) from component
3. Return a typed result object
4. Update component to import and use the hook
5. Create test

See `references/patterns.md` for component and screen hook examples.

## Testing

Hook tests are **required** — they're where module/screen behavior gets unit-tested (module-level rendered components are covered by integration tests, not unit tests). Use `renderHook` from `@testing-library/react`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAccountsQuery } from '../useAccountsQuery'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    fetchAccounts: vi.fn().mockResolvedValue([]),
}))

describe('useAccountsQuery', () => {
    it('returns the accounts list', async () => {
        const { result } = renderHook(() => useAccountsQuery())
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.accounts).toEqual([])
    })
})
```

For hook-tests-with-JSX (e.g. provider wrappers), use `.spec.tsx`; for pure logic hooks, `.spec.ts` is fine.

## Verification

```sh
pnpm pre-push --no-fail-on-error
pnpm test
```

## Checklists

### Naming

- [ ] Hook name starts with `use` prefix (camelCase)
- [ ] Query hooks end with `Query`, mutation hooks with `Mutation`, store hooks with `Store`
- [ ] File name matches hook name exactly

### Type Decoupling

- [ ] Input parameters have explicit type definitions
- [ ] Return value has explicit type definition
- [ ] Return type does NOT use dependency types
- [ ] Only expose necessary properties to consumers
