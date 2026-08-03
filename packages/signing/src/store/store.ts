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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import type { SigningStore, SignRequest } from '../models'
import { isInteractiveSource, type SourceType } from '../pipeline/types'
import {
    logger,
    generateOrderedUniqueId,
    registerStore,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    algorandSafeQuerySerialize,
    algorandSafeQueryParse,
} from '@perawallet/wallet-core-blockchain'

// Custom storage: round-trip safe serialization for bigint and Map
// Uses algorandSafeQuerySerialize/Parse to handle PeraTransaction bigint fields
// (fee, amount, assetId, etc.)

type PartializedState = { pendingSignRequests: SignRequest[] }

const signingStoreStorage = (): PersistStorage<PartializedState> => ({
    getItem: name => {
        const str = getProvider().keyValueStorage.getItem(name)
        if (!str) return null
        try {
            return algorandSafeQueryParse(str as string)
        } catch (error) {
            logger.warn(
                'Failed to parse persisted signing-store; dropping persisted state',
                { error },
            )
            getProvider().keyValueStorage.removeItem(name)
            return null
        }
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

/**
 * Re-validate a rehydrated sign-request before it is allowed back into the
 * signing actor lifecycle. Rehydrated state is attacker-/corruption-reachable
 * (sandboxed MMKV), so we drop anything that is malformed or that would resume
 * WITHOUT an interactive approval gate:
 *   - malformed shape (missing id/type/transport) → can't drive the machine
 *   - non-interactive sources (`'local'`/undefined) → would sign HEADLESSLY on
 *     a cold start, with no review sheet (the same gap class as PERA-4416)
 *   - `'deeplink'` → ephemeral; the user re-scans rather than resuming
 * Interactive, persistable sources (e.g. `multisig-cosign`) are kept.
 */
export const isResumableRehydratedRequest = (
    value: unknown,
): value is SignRequest => {
    if (typeof value !== 'object' || value === null) return false
    const r = value as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id.length === 0) return false
    if (typeof r.type !== 'string' || typeof r.transport !== 'string') {
        return false
    }
    // `callback` transports carry in-memory callbacks that cannot survive
    // serialization; `partialize` already blocks them from being persisted, so
    // a rehydrated entry claiming `transport: 'callback'` is crafted/corrupted
    // — reject it here too rather than surface an approval sheet that can only
    // fail at the transport layer.
    return (
        r.transport !== 'callback' &&
        r.sourceType !== 'deeplink' &&
        isInteractiveSource(r.sourceType as SourceType | undefined)
    )
}

const STORE_NAME = 'signing-store'

const initialState = {
    pendingSignRequests: [] as SignRequest[],
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

                if (remaining.length !== existing.length) {
                    set({ pendingSignRequests: remaining })
                }
                return remaining.length !== existing.length
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
            // Re-validate every rehydrated request before it can enter the
            // signing actor lifecycle. Subsumes the old deeplink strip.
            onRehydrateStorage: () => state => {
                if (state) {
                    state.pendingSignRequests = (
                        state.pendingSignRequests ?? []
                    ).filter(isResumableRehydratedRequest)
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
