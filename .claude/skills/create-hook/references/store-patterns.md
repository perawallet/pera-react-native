# Store Patterns (Zustand)

Location: `packages/[domain]/src/store/store.ts`

## Creating a Store

```typescript
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
    createPersistStorage,
    registerStore,
    type WithPersist,
} from '@perawallet/wallet-core-shared'

export type AccountsState = {
    accounts: WalletAccount[]
    selectedAccountAddress: string | null
}

export type AccountsActions = {
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: string | null) => void
    resetState: () => void
}

export type AccountsStore = AccountsState & AccountsActions

const STORE_NAME = 'accounts-store'

const initialState: AccountsState = {
    accounts: [],
    selectedAccountAddress: null,
}

export const useAccountsStore: UseBoundStore<
    WithPersist<StoreApi<AccountsStore>, unknown>
> = create<AccountsStore>()(
    persist(
        set => ({
            ...initialState,
            setAccounts: accounts => set({ accounts }),
            setSelectedAccountAddress: address =>
                set({ selectedAccountAddress: address }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(createPersistStorage),
            version: 1,
            partialize: state => ({
                accounts: state.accounts,
                selectedAccountAddress: state.selectedAccountAddress,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useAccountsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useAccountsStore.getState().resetState(),
})
```

## Store Access Pattern

```typescript
// Granular selectors
const accounts = useAccountsStore(state => state.accounts)
const selectedAddress = useAccountsStore(state => state.selectedAccountAddress)

// Multiple values with shallow comparison
import { shallow } from 'zustand/shallow'
const { accounts, selectedAccountAddress } = useAccountsStore(
    state => ({
        accounts: state.accounts,
        selectedAccountAddress: state.selectedAccountAddress,
    }),
    shallow,
)

// NEVER do this — subscribes to entire store
const store = useAccountsStore()
const { accounts } = useAccountsStore()
```
