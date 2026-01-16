---
description: Create a new React hook following project conventions
---

# Create Hook Workflow

Use this workflow when creating a new hook.

## Prerequisites

Reference these before starting:

- `.agent/rules/hook-patterns.md` - Detailed hook patterns with examples
- `docs/FOLDER_STRUCTURE.md` - Where to place the hook
- `docs/NAMING_CONVENTIONS.md` - Hook naming patterns

## Determine Hook Type & Location

### 1. Identify Hook Type

| Hook Type            | Suffix     | When to Use                        |
| -------------------- | ---------- | ---------------------------------- |
| React Query (fetch)  | `Query`    | Fetching data from API             |
| React Query (mutate) | `Mutation` | Creating, updating, deleting data  |
| Zustand Store        | `Store`    | Local application state management |
| Component Logic      | Component  | Extracting component/screen logic  |

### 2. Determine Location

| Hook Scope            | Location                                            |
| --------------------- | --------------------------------------------------- |
| Domain-level (shared) | `modules/[moduleName]/hooks/`                       |
| Cross-domain          | `modules/[originDomain]/hooks/` (export via barrel) |
| Screen-specific       | `modules/[moduleName]/screens/[ScreenName]/`        |
| Component-specific    | Same folder as the component                        |

## Steps for React Query Hook

### 1. Create Hook File

Location: `modules/[moduleName]/hooks/use[Name]Query.ts` or `use[Name]Mutation.ts`

```typescript
// useAccountsQuery.ts
import { useQuery } from '@tanstack/react-query'
import { fetchAccounts } from '../api'
import { accountQueryKeys } from '../queryKeys'

/**
 * Fetches all accounts for the current wallet.
 *
 * @returns Account list data and loading state
 *
 * @example
 * const { accounts, isLoading } = useAccountsQuery()
 */
export const useAccountsQuery = () => {
    return useQuery({
        queryKey: accountQueryKeys.all,
        queryFn: fetchAccounts,
    })
}
```

### 2. Add to Barrel File

Update `modules/[moduleName]/hooks/index.ts`:

```typescript
export { useAccountsQuery } from './useAccountsQuery'
```

### 3. Create Test

Create `modules/[moduleName]/hooks/__tests__/use[Name]Query.spec.ts`

## Steps for Zustand Store Hook

### 1. Create Hook File

Location: `modules/[moduleName]/hooks/use[Name]Store.ts`

```typescript
// useAccountsStore.ts
import { useAccountsStore as useStore } from '../store'

/**
 * Accesses the currently selected account from the accounts store.
 *
 * @returns The currently selected account, or null if none selected
 *
 * @example
 * const selectedAccount = useSelectedAccount()
 */
export const useSelectedAccount = () => {
    return useStore(state => state.selectedAccount)
}

/**
 * Provides full access to the accounts store.
 *
 * @returns The accounts store with all state and actions
 */
export const useAccountsStore = () => useStore()
```

### 2. Add to Barrel File

Update `modules/[moduleName]/hooks/index.ts`

### 3. Create Test

Create `modules/[moduleName]/hooks/__tests__/use[Name]Store.spec.ts`

## Steps for Component/Screen Logic Hook

### 1. Create Hook File

Location: Same folder as component/screen

- For `AccountCard/AccountCard.tsx` → `AccountCard/useAccountCard.ts`
- For `AccountScreen/AccountScreen.tsx` → `AccountScreen/useAccountScreen.ts`

```typescript
// useAccountCard.ts

/**
 * Manages the state and logic for the AccountCard component.
 *
 * @param account - The account to display in the card
 * @returns Card state and handlers
 *
 * @example
 * const { isExpanded, isLoading, handleToggle } = useAccountCard(account)
 */
export const useAccountCard = (account: Account) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const { data, isLoading } = useAccountBalanceQuery(account.address)

    const handleToggle = useCallback(() => {
        setIsExpanded(prev => !prev)
    }, [])

    return { isExpanded, isLoading, handleToggle }
}
```

### 2. Update Component

Import and use the hook in the component:

```typescript
// AccountCard.tsx
import { useAccountCard } from './useAccountCard'

const AccountCard = ({ account }: Props) => {
    const { isExpanded, isLoading, handleToggle } = useAccountCard(account)
    return (...)
}
```

### 3. Create Test

Create `ComponentName/__tests__/useComponentName.spec.ts`

## Verification

// turbo

```sh
pnpm test
```

// turbo

```sh
pnpm lint
```

## Naming Checklist

- [ ] Hook name starts with `use` prefix (camelCase)
- [ ] React Query fetch hooks end with `Query`
- [ ] React Query mutation hooks end with `Mutation`
- [ ] Zustand hooks end with `Store`
- [ ] File name matches hook name exactly

## Type Decoupling Checklist

- [ ] Input parameters have explicit type definitions
- [ ] Return value has explicit type definition
- [ ] Return type does NOT use dependency types (UseQueryResult, UseMutationResult, StoreApi)
- [ ] Only expose necessary properties to consumers
- [ ] Hook provides a stable API contract independent of underlying library

## JSDoc Checklist

- [ ] Hook has a JSDoc comment describing its purpose
- [ ] All parameters are documented with `@param`
- [ ] Return value is documented with `@returns`
- [ ] An `@example` is provided for non-trivial usage
