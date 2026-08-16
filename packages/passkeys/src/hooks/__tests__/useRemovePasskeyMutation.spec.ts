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
import { passkeysQueryKey, passkeysQueryKeyRoot } from '../usePasskeysQuery'

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
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: passkeysQueryKeyRoot,
        })
        expect(passkeysQueryKeyRoot).toEqual(['passkeys'])
    })

    // The suffix is restated — the key belongs to
    // `apps/mobile/.../PasskeyMigrationBanner/usePasskeyMigrationBanner.ts`,
    // and mobile depends on this package rather than the reverse — but the
    // root is the exported one both sides build from. It makes the banner's
    // key a *sibling* of `passkeysQueryKey`, so only the shared root reaches
    // it: invalidating `passkeysQueryKey` would leave the banner listing a
    // credential the user just deleted.
    it('invalidates sibling passkey queries, not just the native-credentials key', async () => {
        const flaggedKey = [...passkeysQueryKeyRoot, 'needs-migration']
        const { result } = renderHook(() => useRemovePasskeyMutation(), {
            wrapper: createWrapper(),
        })
        queryClient.setQueryData(flaggedKey, [])
        queryClient.setQueryData(passkeysQueryKey, [])

        await act(async () => {
            await result.current.removePasskey(keystorePasskey)
        })

        expect(queryClient.getQueryState(flaggedKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(passkeysQueryKey)?.isInvalidated).toBe(
            true,
        )
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

    // The banner's delete-and-recreate action targets exactly these rows: the
    // un-adopt in `repairs/0002-rematerialize-passkey-credentials` deleted the
    // k/ record, so the keystore has nothing left to remove. Its own removal
    // can fail and orphan the k/+m/ pair (`:372-380`), but such a credential is
    // then keystore-sourced too and the banner's union attributes it that way,
    // so it arrives here on the branch above.
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
