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
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { AppIntegrityStore } from '../models'

const STORE_NAME = 'app-integrity-store'

// Set by `migrate` when a v1 plaintext token is stripped, read by
// `onRehydrateStorage` to trigger a one-off storage compaction.
let didPurgeToken = false

const initialState = {
    integrityToken: null,
    expiresAt: null,
    keyId: null,
    deviceId: null,
    status: 'idle' as const,
    lastError: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
}

export const useAppIntegrityStore: UseBoundStore<
    WithPersist<StoreApi<AppIntegrityStore>, unknown>
> = create<AppIntegrityStore>()(
    persist(
        set => ({
            ...initialState,
            setRegistration: ({ integrityToken, expiresAt, keyId, deviceId }) =>
                set({
                    integrityToken,
                    expiresAt,
                    keyId,
                    deviceId,
                    status: 'success',
                    lastError: null,
                    lastSuccessAt: new Date().toISOString(),
                }),
            setStatus: status => set({ status }),
            setError: message => set({ status: 'error', lastError: message }),
            setLastAttemptAt: iso => set({ lastAttemptAt: iso }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 2,
            // Purge any plaintext token written by version 1, which persisted
            // `integrityToken`/`expiresAt` to the unencrypted store. Stripping
            // them on rehydrate guarantees the stale credential is removed from
            // disk on the first launch after upgrade, rather than lingering
            // until the token expires. `didPurgeToken` is consumed by
            // `onRehydrateStorage` to compact the store afterwards.
            migrate: persistedState => {
                const next = {
                    ...((persistedState as Record<string, unknown>) ?? {}),
                }
                didPurgeToken =
                    next.integrityToken != null || next.expiresAt != null
                delete next.integrityToken
                delete next.expiresAt
                return next
            },
            // After the migration rewrites the token-free blob, MMKV's
            // append-log still holds the old record's bytes until compaction.
            // `trim()` rewrites the file so the leaked token is physically
            // scrubbed, not just logically overwritten. Only runs when a token
            // was actually purged, and is a no-op on backends without `trim`.
            onRehydrateStorage: () => () => {
                if (!didPurgeToken) return
                didPurgeToken = false
                getProvider().keyValueStorage.trim?.()
            },
            // `integrityToken` and `expiresAt` are intentionally NOT persisted:
            // the token is a bearer-style attestation credential and the
            // platform key-value storage is unencrypted (plaintext MMKV on RN).
            // Keeping them in memory and re-attesting on boot (via
            // useAppIntegrityBootstrap, which re-runs whenever no valid token is
            // present) avoids writing the token to disk. `keyId`/`deviceId` are
            // non-secret identifiers and are kept so iOS can reuse its App
            // Attest key across launches.
            partialize: state => ({
                keyId: state.keyId,
                deviceId: state.deviceId,
                status: state.status,
                lastError: state.lastError,
                lastAttemptAt: state.lastAttemptAt,
                lastSuccessAt: state.lastSuccessAt,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useAppIntegrityStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useAppIntegrityStore.getState().resetState(),
})
