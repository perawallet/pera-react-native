---
trigger: always_on
---

# Hook Patterns

## Business Logic Hooks (in packages/)

Location: `packages/[domain]/src/hooks/`

```typescript
// useAccountBalancesQuery.ts
import { useQuery } from '@tanstack/react-query'
import { fetchAccountBalances } from './endpoints'
import { accountQueryKeys } from './querykeys'

export const useAccountBalancesQuery = (address: string) => {
    return useQuery({
        queryKey: accountQueryKeys.balances(address),
        queryFn: () => fetchAccountBalances(address),
        enabled: !!address,
    })
}
```

## Store Hooks

```typescript
// useAllAccounts.ts
import { useAccountsStore } from '../store'

export const useAllAccounts = () => {
    return useAccountsStore(state => state.accounts)
}
```

## UI Hooks (in apps/mobile/)

Location: `apps/mobile/src/hooks/`

```typescript
// toast.ts
import { useCallback } from 'react'
import { useToastStore } from '@providers/ToastProvider'

type ToastParams = {
    title: string
    body: string
    type: 'info' | 'success' | 'error'
}

const useToast = () => {
    const { showToast: show } = useToastStore()

    const showToast = useCallback(
        (params: ToastParams) => {
            show(params)
        },
        [show],
    )

    return { showToast }
}

export default useToast
```
