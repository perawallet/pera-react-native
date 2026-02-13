# Hook Patterns Reference

## React Query Hook Example (with explicit types)

```typescript
// modules/accounts/hooks/useAccountsQuery.ts
import { useQuery } from '@tanstack/react-query'
import { fetchAccounts } from '../api'
import { accountQueryKeys } from '../queryKeys'

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
    params: UseAccountsQueryParams = {},
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

## Mutation Hook Example

```typescript
// modules/accounts/hooks/useCreateAccountMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAccount } from '../api'
import { accountQueryKeys } from '../queryKeys'

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
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: createAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: accountQueryKeys.all })
        },
    })

    return {
        createAccount: mutation.mutate,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
        isSuccess: mutation.isSuccess,
    }
}
```

## Store Hook Example

```typescript
// modules/accounts/hooks/useAccountsStore.ts
import { useAccountsStore as useStore } from '../store'

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

// Granular selector
export const useSelectedAccount = () => {
    return useStore(state => state.selectedAccount)
}
```

## Component Logic Hook Example

```typescript
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

    return { isExpanded, isLoading, formattedBalance, handleToggle }
}

// AccountCard/AccountCard.tsx
const AccountCard = ({ account }: AccountCardProps) => {
    const { isExpanded, isLoading, formattedBalance, handleToggle } =
        useAccountCard(account)
    return (...)
}
```

## Screen Hook Example

```typescript
// modules/accounts/screens/AccountScreen/useAccountScreen.ts
export const useAccountScreen = () => {
    const { accounts, isLoading } = useAccountsQuery()
    const { selectedAccount } = useSelectedAccount()
    const navigation = useNavigation()

    const handleAccountPress = useCallback(
        (account: Account) => {
            navigation.navigate('AccountDetails', { address: account.address })
        },
        [navigation],
    )

    return { accounts, isLoading, selectedAccount, handleAccountPress }
}
```

## Domain Hook Directory Structure

```
modules/accounts/
├── hooks/
│   ├── useAccountsQuery.ts
│   ├── useAccountBalanceQuery.ts
│   ├── useCreateAccountMutation.ts
│   ├── useAccountsStore.ts
│   └── index.ts                   ← Barrel file
├── screens/
└── components/
```
