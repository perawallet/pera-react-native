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

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useAppIntegrityStore } from '../store'

const STORE_NAME = 'app-integrity-store'

const readPersistedState = (): Record<string, unknown> => {
    const raw = getProvider().keyValueStorage.getItem(STORE_NAME)
    return raw ? JSON.parse(raw).state : {}
}

const rehydrate = (): Promise<void> =>
    (
        useAppIntegrityStore as unknown as {
            persist: { rehydrate: () => Promise<void> }
        }
    ).persist.rehydrate()

describe('useAppIntegrityStore', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        useAppIntegrityStore.getState().resetState()
    })

    it('stores a registration result', () => {
        useAppIntegrityStore.getState().setRegistration({
            integrityToken: 'jwt',
            expiresAt: '2026-07-01',
            keyId: 'k1',
            deviceId: 'd1',
        })
        const state = useAppIntegrityStore.getState()
        expect(state.integrityToken).toBe('jwt')
        expect(state.keyId).toBe('k1')
        expect(state.status).toBe('success')
        expect(state.lastSuccessAt).not.toBeNull()
    })

    it('never persists the bearer token or its expiry to storage', () => {
        useAppIntegrityStore.getState().setRegistration({
            integrityToken: 'jwt',
            expiresAt: '2026-07-01',
            keyId: 'k1',
            deviceId: 'd1',
        })

        const persisted = readPersistedState()
        // The attestation token is a bearer credential and storage is
        // unencrypted, so it must stay in memory only.
        expect(persisted.integrityToken).toBeUndefined()
        expect(persisted.expiresAt).toBeUndefined()
        // Non-secret identifiers are still persisted.
        expect(persisted.keyId).toBe('k1')
        expect(persisted.deviceId).toBe('d1')
    })

    it('strips a v1 plaintext token from storage and compacts on rehydrate', async () => {
        const trimSpy = vi.spyOn(getProvider().keyValueStorage, 'trim')
        // Simulate an install that persisted the token under schema version 1.
        getProvider().keyValueStorage.setItem(
            STORE_NAME,
            JSON.stringify({
                version: 1,
                state: {
                    integrityToken: 'leaked-jwt',
                    expiresAt: '2026-07-01',
                    keyId: 'k1',
                    deviceId: 'd1',
                    status: 'success',
                },
            }),
        )

        await rehydrate()

        const persisted = readPersistedState()
        expect(persisted.integrityToken).toBeUndefined()
        expect(persisted.expiresAt).toBeUndefined()
        // The migration leaves non-secret fields intact.
        expect(persisted.keyId).toBe('k1')
        // The token is not rehydrated into memory either.
        expect(useAppIntegrityStore.getState().integrityToken).toBeNull()
        // The store is compacted so the old plaintext bytes are scrubbed.
        expect(trimSpy).toHaveBeenCalledTimes(1)
    })

    it('does not compact when there is no v1 token to purge', async () => {
        const trimSpy = vi.spyOn(getProvider().keyValueStorage, 'trim')
        // Already on the current schema version with no token persisted.
        getProvider().keyValueStorage.setItem(
            STORE_NAME,
            JSON.stringify({
                version: 2,
                state: { keyId: 'k1', deviceId: 'd1', status: 'success' },
            }),
        )

        await rehydrate()

        expect(trimSpy).not.toHaveBeenCalled()
    })

    it('records errors', () => {
        useAppIntegrityStore.getState().setError('boom')
        const state = useAppIntegrityStore.getState()
        expect(state.status).toBe('error')
        expect(state.lastError).toBe('boom')
    })

    it('resets to defaults', () => {
        useAppIntegrityStore.getState().setError('boom')
        useAppIntegrityStore.getState().resetState()
        expect(useAppIntegrityStore.getState().status).toBe('idle')
        expect(useAppIntegrityStore.getState().lastError).toBeNull()
    })
})
