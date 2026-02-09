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
import {
    KeyValueStorageService,
    useKeyValueStorageService,
} from '@perawallet/wallet-core-platform-integration'
import type { AccountsState, WalletAccount } from '../models'
import {
    createLazyStore,
    DataStoreRegistry,
    type WithPersist,
} from '@perawallet/wallet-core-shared'

const STORE_NAME = 'accounts-store'
const lazy =
    createLazyStore<WithPersist<StoreApi<AccountsState>, unknown>>(STORE_NAME)

export const useAccountsStore: UseBoundStore<
    WithPersist<StoreApi<AccountsState>, unknown>
> = lazy.useStore

const initialState = {
    accounts: [] as WalletAccount[],
    selectedAccountAddress: null as string | null,
}

export const createAccountsStore = (storage: KeyValueStorageService) =>
    create<AccountsState>()(
        persist(
            (set, get) => ({
                ...initialState,
                getSelectedAccount: () => {
                    const { accounts, selectedAccountAddress } = get()

                    if (!selectedAccountAddress) {
                        return null
                    }
                    return (
                        accounts.find(
                            a => a.address === selectedAccountAddress,
                        ) ?? null
                    )
                },
                setAccounts: (accounts: WalletAccount[]) => {
                    const currentSelected = get().selectedAccountAddress
                    set({ accounts })

                    if (currentSelected == null && accounts.length) {
                        set({ selectedAccountAddress: accounts.at(0)?.address })
                    } else if (
                        !accounts.find(a => a.address === currentSelected)
                    ) {
                        set({ selectedAccountAddress: null })
                    }
                },
                setSelectedAccountAddress: (address: string | null) => {
                    set({ selectedAccountAddress: address })
                },
                resetState: () => set(initialState),
            }),
            {
                name: STORE_NAME,
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    accounts: state.accounts,
                    selectedAccountAddress: state.selectedAccountAddress,
                }),
            },
        ),
    )

export const initAccountsStore = () => {
    const storage = useKeyValueStorageService()
    const realStore = createAccountsStore(storage)
    lazy.init(realStore, () => realStore.getState().resetState())
}

export const clearAccountsStore = () => lazy.clear()

export const registerAccountsStore = () =>
    DataStoreRegistry.register({
        name: STORE_NAME,
        init: initAccountsStore,
        clear: clearAccountsStore,
    })
