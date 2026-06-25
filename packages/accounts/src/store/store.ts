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
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    AccountTypes,
    type AccountsState,
    type AccountSortMode,
    type WalletAccount,
    type WatchAccount,
} from '../models'
import {
    logger,
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'accounts-store'

const initialState = {
    accounts: [] as WalletAccount[],
    selectedAccountAddress: null as Nullable<string>,
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
                // Single chokepoint for every account write — dedupe by
                // address (keep first) so no caller can ever persist the same
                // account twice. Callers that need to surface duplicates to
                // the user (batch import) still throw DuplicateAccountError
                // before reaching here; this is the structural safety net.
                const seen = new Set<string>()
                accounts = accounts.filter(a =>
                    seen.has(a.address) ? false : (seen.add(a.address), true),
                )

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
            setSelectedAccountAddress: (address: Nullable<string>) => {
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
            updateAccountRekeyAddress: (
                address: string,
                rekeyAddress: string | null,
            ) => {
                const accounts = get().accounts
                const idx = accounts.findIndex(a => a.address === address)
                if (idx === -1) return

                const current = accounts[idx]
                const nextValue = rekeyAddress ?? undefined
                if (current.rekeyAddress === nextValue) return

                const next = [...accounts]
                next[idx] = { ...current, rekeyAddress: nextValue }
                set({ accounts: next })
            },
            addRekeyedWatchAccounts: (
                sourceAddress: string,
                addresses: string[],
            ) => {
                if (addresses.length === 0) return 0

                const current = get().accounts
                const currentAddresses = new Set(current.map(a => a.address))
                const watchAccounts: WatchAccount[] = addresses
                    .filter(addr => !currentAddresses.has(addr))
                    .map(address => ({
                        id: generateOrderedUniqueId(),
                        address,
                        type: AccountTypes.watch,
                        rekeyAddress: sourceAddress,
                    }))

                if (watchAccounts.length === 0) return 0

                get().setAccounts([...current, ...watchAccounts])
                return watchAccounts.length
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            partialize: state => ({
                accounts: state.accounts,
                selectedAccountAddress: state.selectedAccountAddress,
                sortMode: state.sortMode,
                manualAccountOrder: state.manualAccountOrder,
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
