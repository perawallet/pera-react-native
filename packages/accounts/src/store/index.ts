import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useKeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
import type { AccountsState, WalletAccount } from '../models'
import type { WithPersist } from '@perawallet/wallet-core-shared'

export const useAccountsStore: UseBoundStore<
    WithPersist<StoreApi<AccountsState>, unknown>
> = create<AccountsState>()(
    persist(
        (set, get) => ({
            accounts: [],
            selectedAccountAddress: null,
            getSelectedAccount: () => {
                const { accounts, selectedAccountAddress } = get()

                if (!selectedAccountAddress) {
                    return null
                }
                return (
                    accounts.find(a => a.address === selectedAccountAddress) ??
                    null
                )
            },
            setAccounts: (accounts: WalletAccount[]) => {
                const currentSelected = get().selectedAccountAddress
                set({ accounts })

                if (currentSelected === null && accounts.length) {
                    set({ selectedAccountAddress: accounts.at(0)?.address })
                }

                if (!accounts.find(a => a.address === currentSelected)) {
                    set({ selectedAccountAddress: null })
                }
            },
            setSelectedAccountAddress: (address: string | null) => {
                set({ selectedAccountAddress: address })
            },
        }),
        {
            name: 'accounts-store',
            storage: createJSONStorage(useKeyValueStorageService),
            version: 1,
            partialize: state => ({
                accounts: state.accounts,
                selectedAccountAddress: state.selectedAccountAddress,
            }),
        },
    ),
)
