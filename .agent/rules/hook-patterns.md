---
trigger: always_on
---

# Hook Patterns

All hooks MUST use the `use` prefix with camelCase naming.

## Hook Types & Naming Conventions

| Hook Type       | Suffix      | Technology   | Example                         |
| --------------- | ----------- | ------------ | ------------------------------- |
| React Query     | `Query`     | TanStack RQ  | `useAccountBalancesQuery`       |
| React Mutation  | `Mutation`  | TanStack RQ  | `useCreateAccountMutation`      |
| Zustand Store   | `Store`     | Zustand      | `useAccountsStore`              |
| Component Logic | Component   | React        | `useAccountCard`                |

## Hook Location Rules

| Hook Scope               | Location                                       |
| ------------------------ | ---------------------------------------------- |
| Domain-level (shared)    | `modules/[moduleName]/hooks/`                  |
| Screen-specific          | `modules/[moduleName]/screens/[ScreenName]/`   |
| Component-specific       | Same folder as the component                   |

## Hook Type Definitions (REQUIRED)

All hooks MUST define clear types for inputs and outputs. Hooks MUST NOT expose dependency-specific types to consumers.

**Why this matters:**
- Decouples the application from specific library implementations
- Enables swapping dependencies without breaking consumers
- Provides clear contracts for hook behavior
- Improves IDE autocompletion and documentation

```typescript
// ❌ BAD: Exposing React Query types directly
import { UseQueryResult } from '@tanstack/react-query'

export const useAccountsQuery = (): UseQueryResult<Account[]> => {
    return useQuery({ ... })
}

// ❌ BAD: No type definitions
export const useAccountsQuery = () => {
    return useQuery({ ... })  // Consumer sees UseQueryResult internals
}

// ✅ GOOD: Define explicit return type, hide dependency types
type UseAccountsQueryParams = {
    isEnabled?: boolean
}

type UseAccountsQueryResult = {
    accounts: Account[]
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

export const useAccountsQuery = (
    params: UseAccountsQueryParams = {}
): UseAccountsQueryResult => {
    const { isEnabled = true } = params
    const query = useQuery({
        queryKey: accountQueryKeys.all,
        queryFn: fetchAccounts,
        enabled: isEnabled,
    })

    return {
        accounts: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    }
}
```

```typescript
// ✅ GOOD: Mutation hook with explicit types
type CreateAccountParams = {
    name: string
    type: AccountType
}

type UseCreateAccountMutationResult = {
    createAccount: (params: CreateAccountParams) => void
    isLoading: boolean
    isError: boolean
    error: Error | null
    isSuccess: boolean
}

export const useCreateAccountMutation = (): UseCreateAccountMutationResult => {
    const mutation = useMutation({ ... })

    return {
        createAccount: mutation.mutate,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
        isSuccess: mutation.isSuccess,
    }
}
```

```typescript
// ✅ GOOD: Store hook with explicit types
type UseAccountsStoreResult = {
    accounts: Account[]
    selectedAccount: Account | null
    setSelectedAccount: (account: Account | null) => void
}

export const useAccountsStore = (): UseAccountsStoreResult => {
    const store = useStore()
    return {
        accounts: store.accounts,
        selectedAccount: store.selectedAccount,
        setSelectedAccount: store.setSelectedAccount,
    }
}
```

## React Query Hooks (Async Requests)

**REQUIRED** for all async operations (API calls, data fetching).

```typescript
// modules/accounts/hooks/useAccountBalancesQuery.ts
import { useQuery } from '@tanstack/react-query'
import { fetchAccountBalances } from '../api'
import { accountQueryKeys } from '../queryKeys'

export const useAccountBalancesQuery = (address: string) => {
    return useQuery({
        queryKey: accountQueryKeys.balances(address),
        queryFn: () => fetchAccountBalances(address),
        enabled: !!address,
    })
}
```

```typescript
// modules/accounts/hooks/useCreateAccountMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAccount } from '../api'
import { accountQueryKeys } from '../queryKeys'

export const useCreateAccountMutation = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: createAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: accountQueryKeys.all,
            })
        },
    })
}
```

## Zustand Store Hooks (Local State)

**REQUIRED** for all local application state management.

```typescript
// modules/accounts/hooks/useAccountsStore.ts
import { useAccountsStore as useStore } from '../store'

// Granular selector for specific state
export const useSelectedAccount = () => {
    return useStore(state => state.selectedAccount)
}

// Full store access (use sparingly)
export const useAccountsStore = () => {
    return useStore()
}
```

## Component Logic Extraction (REQUIRED)

**FORBIDDEN**: Complex hooks and logic written directly in component body.

Every component/screen with complex logic MUST extract it to a dedicated hook.

```typescript
// ❌ BAD: Logic in component body
const AccountCard = ({ account }: AccountCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const { data: balance } = useAccountBalanceQuery(account.address)
    
    const formattedBalance = useMemo(() => {
        return formatCurrency(balance)
    }, [balance])

    const handleToggle = useCallback(() => {
        setIsExpanded(prev => !prev)
        analytics.track('card_toggle')
    }, [])

    return (...)
}

// ✅ GOOD: Logic extracted to hook in same folder
// AccountCard/useAccountCard.ts
export const useAccountCard = (account: Account) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const { data: balance, isLoading } = useAccountBalanceQuery(account.address)

    const formattedBalance = useMemo(() => {
        return formatCurrency(balance)
    }, [balance])

    const handleToggle = useCallback(() => {
        setIsExpanded(prev => !prev)
        analytics.track('card_toggle')
    }, [])

    return {
        isExpanded,
        isLoading,
        formattedBalance,
        handleToggle,
    }
}

// AccountCard/AccountCard.tsx
const AccountCard = ({ account }: AccountCardProps) => {
    const { isExpanded, isLoading, formattedBalance, handleToggle } = 
        useAccountCard(account)

    return (...)
}
```

## Screen-Specific Hooks

Live inside the screen folder, named `use[ScreenName].ts`.

```
modules/accounts/screens/AccountScreen/
├── AccountScreen.tsx
├── useAccountScreen.ts    ← Screen-specific hook
├── styles.ts
└── index.ts
```

```typescript
// modules/accounts/screens/AccountScreen/useAccountScreen.ts
export const useAccountScreen = () => {
    const { accounts, isLoading } = useAccountsQuery()
    const { selectedAccount } = useSelectedAccount()
    const navigation = useNavigation()

    const handleAccountPress = useCallback((account: Account) => {
        navigation.navigate('AccountDetails', { address: account.address })
    }, [navigation])

    return {
        accounts,
        isLoading,
        selectedAccount,
        handleAccountPress,
    }
}
```

## Domain-Level Hooks

Live in `modules/[moduleName]/hooks/` and can be shared across the domain.

```
modules/accounts/
├── hooks/
│   ├── useAccountsQuery.ts        ← Domain query hook
│   ├── useAccountBalanceQuery.ts
│   ├── useCreateAccountMutation.ts
│   ├── useAccountsStore.ts        ← Domain store hook
│   └── index.ts                   ← Barrel file
├── screens/
└── components/
```

## Cross-Domain Hook Usage

Hooks from one domain that need to be used by other domains:
- Keep in `modules/[originDomain]/hooks/`
- Export via the domain's public API (`modules/[domain]/index.ts`)
- Import using the domain's barrel file

```typescript
// In modules/transactions/ using accounts hook
import { useAccountBalanceQuery } from '@modules/accounts'
```
