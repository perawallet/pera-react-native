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
import type { FailedSignRequest, SigningStore, SignRequest } from '../models'
import type { TransportResult } from '../pipeline/types'
import {
    generateOrderedUniqueId,
    registerStore,
    type WithPersist,
    type Nullable,
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
    lastCompletedRequest: null as Nullable<SignRequest>,
    lastFailedRequest: null as Nullable<FailedSignRequest>,
    lastTransportResult: null as Nullable<TransportResult>,
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
            setLastCompletedRequest: (request: Nullable<SignRequest>) => {
                set({ lastCompletedRequest: request })
            },
            setLastFailedRequest: (failed: FailedSignRequest | null) => {
                set({ lastFailedRequest: failed })
            },
            setLastTransportResult: (result: Nullable<TransportResult>) => {
                set({ lastTransportResult: result })
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: signingStoreStorage(),
            version: 1,
            partialize: state => ({
                // Persist only non-callback, non-deeplink requests:
                //   - callback transports (WalletConnect, webview) carry
                //     non-serializable approve/reject closures
                //   - deeplink requests are ephemeral — the user just
                //     scanned a QR; if anything fails (bad shape, missing
                //     signer, etc.) they should be able to scan again
                //     instead of being trapped on the broken sheet.
                pendingSignRequests: state.pendingSignRequests.filter(
                    r =>
                        r.transport !== 'callback' &&
                        r.sourceType !== 'deeplink',
                ),
            }),
            // Belt-and-suspenders: these fields aren't in `partialize`, but a
            // prior store version (or a future migration regression) could
            // still leave them in storage. Always boot with a clean
            // last-completed/last-failed slate so a stale id doesn't ghost
            // the next request through SignRequestView's id-equality guard.
            // Also strip any rehydrated deeplink request — covers the case
            // where an older partialize persisted them, and matches the
            // partialize filter above so the two stay in lockstep.
            onRehydrateStorage: () => state => {
                if (state) {
                    state.lastCompletedRequest = null
                    state.lastFailedRequest = null
                    state.lastTransportResult = null
                    state.pendingSignRequests = (
                        state.pendingSignRequests ?? []
                    ).filter(r => r.sourceType !== 'deeplink')
                }
            },
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
