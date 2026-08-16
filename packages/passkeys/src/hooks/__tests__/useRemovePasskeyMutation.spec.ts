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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { Passkey } from '../../models/passkey'

const mocks = vi.hoisted(() => ({
    getProvider: vi.fn(),
    deleteCredential: vi.fn(),
    refreshCredentialIdentities: vi.fn(),
    removeKey: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: mocks.getProvider,
}))

import { useRemovePasskeyMutation } from '../useRemovePasskeyMutation'
import { passkeysQueryKey } from '../usePasskeysQuery'

const keystorePasskey: Passkey = {
    id: 'cred-a',
    keyId: 'cred-a',
    displayName: 'Alice',
    origin: 'webauthn.io',
    userHandle: 'alice',
    algorithm: 'P256',
    createdAt: 100,
    source: 'keystore',
    needsMigration: false,
}

const nativePasskey: Passkey = {
    ...keystorePasskey,
    id: 'native-x',
    keyId: 'native-x',
    source: 'native',
}

const providerPasskey: Passkey = {
    ...keystorePasskey,
    id: 'flat-x',
    keyId: 'flat-x',
    source: 'provider',
    needsMigration: true,
}

let queryClient: QueryClient

const createWrapper = () => {
    queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useRemovePasskeyMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.deleteCredential.mockResolvedValue(undefined)
        mocks.refreshCredentialIdentities.mockResolvedValue(undefined)
        mocks.removeKey.mockResolvedValue(undefined)
        mocks.getProvider.mockReturnValue({
            passkeyAutofill: {
                deleteCredential: mocks.deleteCredential,
                refreshCredentialIdentities: mocks.refreshCredentialIdentities,
            },
            key: { store: { remove: mocks.removeKey } },
        })
    })

    it('deletes a keystore-backed passkey from native, the keystore, then refreshes and invalidates', async () => {
        const { result } = renderHook(() => useRemovePasskeyMutation(), {
            wrapper: createWrapper(),
        })
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

        await act(async () => {
            await result.current.removePasskey(keystorePasskey)
        })

        expect(mocks.deleteCredential).toHaveBeenCalledWith('cred-a')
        expect(mocks.removeKey).toHaveBeenCalledWith('cred-a')
        expect(mocks.refreshCredentialIdentities).toHaveBeenCalled()
        expect(invalidate).toHaveBeenCalledWith({ queryKey: passkeysQueryKey })
    })

    it('skips keystore removal for a native-only passkey', async () => {
        const { result } = renderHook(() => useRemovePasskeyMutation(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.removePasskey(nativePasskey)
        })

        expect(mocks.deleteCredential).toHaveBeenCalledWith('native-x')
        expect(mocks.removeKey).not.toHaveBeenCalled()
        expect(mocks.refreshCredentialIdentities).toHaveBeenCalled()
    })

    // The banner's delete-and-recreate action targets exactly these rows. A
    // flagged credential has no k/ record left to remove — the un-adopt in
    // `repairs/0002-rematerialize-passkey-credentials` deleted it — so routing
    // it through the keystore would reject and strand the credential.
    it('skips keystore removal for a flat provider-store passkey', async () => {
        const { result } = renderHook(() => useRemovePasskeyMutation(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.removePasskey(providerPasskey)
        })

        expect(mocks.deleteCredential).toHaveBeenCalledWith('flat-x')
        expect(mocks.removeKey).not.toHaveBeenCalled()
    })

    it('still removes the keystore key when the best-effort native delete rejects', async () => {
        mocks.deleteCredential.mockRejectedValue(
            new Error('not on this device'),
        )

        const { result } = renderHook(() => useRemovePasskeyMutation(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.removePasskey(keystorePasskey)
        })

        expect(mocks.removeKey).toHaveBeenCalledWith('cred-a')
        expect(result.current.isError).toBe(false)
    })
})
