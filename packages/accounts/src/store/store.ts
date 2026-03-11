/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AccountsState, AccountSortMode, WalletAccount } from '../models'
import {
    logger,
    registerStore,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'accounts-store'

const initialState = {
    accounts: [] as WalletAccount[],
    selectedAccountAddress: null as string | null,
    sortMode: 'manual' as AccountSortMode,
    manualAccountOrder: [] as string[],
}

export const useAccountsStore: UseBoundStore<
    WithPersist<StoreApi<AccountsState>, unknown>
> = create<AccountsState>()(
    persist(
        (set, get) => ({
            ...initialState,
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
                const currentManualOrder = get().manualAccountOrder
                set({ accounts })

                if (currentSelected == null && accounts.length) {
                    set({ selectedAccountAddress: accounts.at(0)?.address })
                } else if (!accounts.find(a => a.address === currentSelected)) {
                    set({
                        selectedAccountAddress: accounts.at(0)?.address ?? null,
                    })
                }

                const accountAddresses = new Set(accounts.map(a => a.address))
                const prunedOrder = currentManualOrder.filter(addr =>
                    accountAddresses.has(addr),
                )
                const newAddresses = accounts
                    .map(a => a.address)
                    .filter(addr => !prunedOrder.includes(addr))
                set({ manualAccountOrder: [...prunedOrder, ...newAddresses] })
            },
            setSelectedAccountAddress: (address: string | null) => {
                const accounts = get().accounts
                if (address && !accounts.find(a => a.address === address)) {
                    logger.warn(
                        `Attempted to set selected account address to ${address}, but it does not exist in accounts list.`,
                    )
                    return
                }
                set({ selectedAccountAddress: address })
            },
            setSortMode: (mode: AccountSortMode) => {
                set({ sortMode: mode })
            },
            setManualAccountOrder: (order: string[]) => {
                set({ manualAccountOrder: order })
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 2,
            partialize: state => ({
                accounts: state.accounts,
                selectedAccountAddress: state.selectedAccountAddress,
                sortMode: state.sortMode,
                manualAccountOrder: state.manualAccountOrder,
            }),
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as Record<string, unknown>
                if (version < 2) {
                    const accounts = (state.accounts ?? []) as WalletAccount[]
                    state.sortMode = 'manual'
                    state.manualAccountOrder = accounts.map(a => a.address)
                }
                return state as AccountsState
            },
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
