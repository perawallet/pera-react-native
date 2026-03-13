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
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import type { SigningStore, SignRequest } from '../models'
import {
    generateOrderedUniqueId,
    registerStore,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    algorandSafeQuerySerialize,
    algorandSafeQueryParse,
} from '@perawallet/wallet-core-blockchain'

// =============================================================================
// Custom storage: round-trip safe serialization for bigint and Map
// Uses algorandSafeQuerySerialize/Parse to handle PeraTransaction bigint fields
// (fee, amount, assetId, etc.)
// =============================================================================

type PartializedState = { pendingSignRequests: SignRequest[] }

const signingStoreStorage = (): PersistStorage<PartializedState> => ({
    getItem: name => {
        const str = getProvider().keyValueStorage.getItem(name)
        if (!str) return null
        return algorandSafeQueryParse(str as string)
    },
    setItem: (name, value) => {
        getProvider().keyValueStorage.setItem(
            name,
            algorandSafeQuerySerialize(value),
        )
    },
    removeItem: name => {
        getProvider().keyValueStorage.removeItem(name)
    },
})

const STORE_NAME = 'signing-store'

const initialState = {
    pendingSignRequests: [] as SignRequest[],
    lastCompletedRequest: null as SignRequest | null,
}

export const useSigningStore: UseBoundStore<
    WithPersist<StoreApi<SigningStore>, PartializedState>
> = create<SigningStore>()(
    persist(
        (set, get) => ({
            ...initialState,
            addSignRequest: (request: SignRequest) => {
                const existing = get().pendingSignRequests ?? []
                const newRequest = {
                    ...request,
                    id: request.id ?? generateOrderedUniqueId(),
                }
                if (!existing.find(r => r.id === newRequest.id)) {
                    set({ pendingSignRequests: [...existing, newRequest] })
                    return true
                }
                return false
            },
            removeSignRequest: (request: SignRequest) => {
                const existing = get().pendingSignRequests ?? []
                const remaining = existing.filter(r => r.id !== request.id)

                if (remaining.length != existing.length) {
                    set({ pendingSignRequests: remaining })
                }
                return remaining.length != existing.length
            },
            setLastCompletedRequest: (request: SignRequest | null) => {
                set({ lastCompletedRequest: request })
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: signingStoreStorage(),
            version: 1,
            partialize: state => ({
                // Persist only non-callback requests (actors are not serializable,
                // callback/WalletConnect requests are ephemeral)
                pendingSignRequests: state.pendingSignRequests.filter(
                    r => r.transport !== 'callback',
                ),
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSigningStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSigningStore.getState().resetState(),
})
