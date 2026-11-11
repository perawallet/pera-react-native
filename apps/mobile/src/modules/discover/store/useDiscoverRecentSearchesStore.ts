/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { create } from 'zustand'
import {
    assetRefKey,
    type AssetRef,
} from '@perawallet/wallet-core-chain-contract'
import {
    guardedPersist,
    registerStore,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { DiscoverDapp } from '../types'
import { normalizeDappUrl } from '../utils/normalizeDappUrl'

export type RecentSearch =
    | { kind: 'url'; url: string }
    | { kind: 'dapp'; dapp: DiscoverDapp }
    | {
          kind: 'asset'
          ref: AssetRef
          name: string
          unitName: string
          logo: Nullable<string>
      }

export const MAX_RECENT_SEARCHES = 10

export const recentSearchKey = (item: RecentSearch): string => {
    switch (item.kind) {
        case 'url': {
            return `url:${normalizeDappUrl(item.url) ?? item.url}`
        }
        case 'dapp': {
            return `dapp:${normalizeDappUrl(item.dapp.url) ?? item.dapp.url}`
        }
        case 'asset': {
            return `asset:${assetRefKey(item.ref)}`
        }
    }
}

type RecentSearchesState = { items: RecentSearch[] }

type RecentSearchesActions = {
    push(item: RecentSearch): void
    remove(key: string): void
    clear(): void
    resetState(): void
}

const STORE_NAME = 'discover-recent-searches-store'

const initialState: RecentSearchesState = { items: [] }

export const useDiscoverRecentSearchesStore = create<
    RecentSearchesState & RecentSearchesActions
>()(
    guardedPersist(
        set => ({
            ...initialState,
            push: item => {
                const key = recentSearchKey(item)
                set(state => ({
                    items: [
                        item,
                        ...state.items.filter(i => recentSearchKey(i) !== key),
                    ].slice(0, MAX_RECENT_SEARCHES),
                }))
            },
            remove: key =>
                set(state => ({
                    items: state.items.filter(i => recentSearchKey(i) !== key),
                })),
            clear: () => set(initialState),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            version: 1,
            storage: () => getProvider().keyValueStorage,
            migrate: (persisted, version) =>
                version === 1
                    ? (persisted as RecentSearchesState)
                    : initialState,
            partialize: state => ({ items: state.items }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () => useDiscoverRecentSearchesStore.persist.clearStorage(),
    resetState: () => useDiscoverRecentSearchesStore.getState().resetState(),
})
