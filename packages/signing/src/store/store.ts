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
import { isChainId, type ChainId } from '@perawallet/wallet-core-chain-contract'
import type { SigningStore, SignRequest } from '../models'
import { isUnsignedTransaction } from '../models/guards'
import { isInteractiveSource, type SourceType } from '../pipeline/types'
import {
    logger,
    generateOrderedUniqueId,
    registerStore,
    stringifyTypedJson,
    parseTypedJson,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { gateWritesOnHydration } from './hydrationGate'

// Custom storage: round-trip safe serialization for bigint and Map, which
// PeraTransaction fields (fee, amount, assetId, etc.) rely on.

type PartializedState = { pendingSignRequests: SignRequest[] }

const signingStoreStorage = (): PersistStorage<PartializedState> => ({
    getItem: name => {
        const str = getProvider().keyValueStorage.getItem(name)
        if (!str) return null
        try {
            return parseTypedJson(str as string)
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
        getProvider().keyValueStorage.setItem(name, stringifyTypedJson(value))
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
 *     a cold start, with no review sheet
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
    if (!isChainId(r.chainId) && !isChainNeutralTransactionRequest(r)) {
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

const isChainNeutralTransactionRequest = (
    request: Record<string, unknown>,
): boolean =>
    Array.isArray(request.txs) &&
    request.txs.length > 0 &&
    isUnsignedTransaction(request.txs[0])

const STORE_VERSION = 2

/**
 * Requests persisted before v2 carry no chain stamp. The caller names the
 * chain they belong to; without one they are dropped, since a request can't be
 * routed to adapters without its chain.
 */
export const migrateSigningState = (
    persistedState: unknown,
    unstampedRequestChainId?: ChainId,
): PartializedState => {
    const state = (persistedState ?? {}) as { pendingSignRequests?: unknown }
    const requests = Array.isArray(state.pendingSignRequests)
        ? (state.pendingSignRequests as Record<string, unknown>[])
        : []
    const pendingSignRequests = requests.flatMap(request => {
        if (
            typeof request !== 'object' ||
            request === null ||
            'chainId' in request ||
            isChainNeutralTransactionRequest(request)
        ) {
            return [request]
        }
        return unstampedRequestChainId === undefined
            ? []
            : [{ ...request, chainId: unstampedRequestChainId }]
    })
    return {
        pendingSignRequests: pendingSignRequests as unknown as SignRequest[],
    }
}

const STORE_NAME = 'signing-store'

const initialState = {
    pendingSignRequests: [] as SignRequest[],
}

/**
 * Ids of requests that came back from persisted storage on this launch. Only
 * these can be re-presentations of a group that may already be on chain, so
 * only these pay for the submission-ledger guard before an actor is created —
 * a request the user just initiated stays on the synchronous path.
 */
const restoredRequestIds = new Set<string>()

export const wasRestoredFromStorage = (id: string): boolean =>
    restoredRequestIds.has(id)

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
            ...gateWritesOnHydration<SigningStore, PartializedState>(
                signingStoreStorage(),
            ),
            version: STORE_VERSION,
            // Hydrated by rehydrateSigningStore, which supplies the chain of
            // requests persisted before they were stamped.
            skipHydration: true,
            migrate: persistedState => migrateSigningState(persistedState),
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
                    state.pendingSignRequests.forEach(request =>
                        restoredRequestIds.add(request.id),
                    )
                }
            },
        },
    ),
)

/** Call once at startup, before any sign request is added. */
export const rehydrateSigningStore = async ({
    unstampedRequestChainId,
}: {
    unstampedRequestChainId: ChainId
}): Promise<void> => {
    useSigningStore.persist.setOptions({
        migrate: persistedState =>
            migrateSigningState(persistedState, unstampedRequestChainId),
    })
    await useSigningStore.persist.rehydrate()
}

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
