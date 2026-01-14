---
trigger: always_on
---

# Store Patterns (Zustand)

Location: `packages/[domain]/src/store/store.ts`

## Creating a Store

```typescript
import { createStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { KeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
import { createLazyStore } from '@perawallet/wallet-core-shared'

export type AccountsState = {
    accounts: WalletAccount[]
    selectedAccountAddress: string | null
}

export type AccountsActions = {
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: string | null) => void
}

export type AccountsStore = AccountsState & AccountsActions

const initialState: AccountsState = {
    accounts: [],
    selectedAccountAddress: null,
}

export const createAccountsStore = (storage: KeyValueStorageService) =>
    createStore<AccountsStore>()(
        persist(
            set => ({
                ...initialState,
                setAccounts: accounts => set({ accounts }),
                setSelectedAccountAddress: address =>
                    set({ selectedAccountAddress: address }),
            }),
            {
                name: 'accounts-storage',
                storage: createJSONStorage(() => ({
                    getItem: key => storage.getItem(key),
                    setItem: (key, value) => storage.setItem(key, value),
                    removeItem: key => storage.removeItem(key),
                })),
            },
        ),
    )

// Lazy initialization
export const { useStore: useAccountsStore, initStore: initAccountsStore } =
    createLazyStore<AccountsStore, [KeyValueStorageService]>(
        createAccountsStore,
    )
```

## Store Access Pattern

```typescript
// ✅ GOOD: Granular selectors
const accounts = useAccountsStore(state => state.accounts)
const selectedAddress = useAccountsStore(state => state.selectedAccountAddress)

// ✅ GOOD: Multiple values with shallow comparison
import { shallow } from 'zustand/shallow'
const { accounts, selectedAccountAddress } = useAccountsStore(
    state => ({
        accounts: state.accounts,
        selectedAccountAddress: state.selectedAccountAddress,
    }),
    shallow,
)

// ❌ BAD: Subscribes to entire store
const store = useAccountsStore()
const { accounts } = useAccountsStore()
```
