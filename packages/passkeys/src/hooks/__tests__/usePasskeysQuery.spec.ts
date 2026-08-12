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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { Key, KeyStoreState } from '@algorandfoundation/keystore-core'
import type { NativeStoredCredential } from '@perawallet/wallet-extension-passkey-autofill'

const mocks = vi.hoisted(() => ({
    getProvider: vi.fn(),
    getStoredCredentials: vi.fn(),
}))

// Minimal TanStack-store fake: `state` getter + `subscribe` returning
// `{ unsubscribe }`, matching the slice usePasskeysQuery reads via
// useSyncExternalStore.
type FakeStore = {
    state: KeyStoreState
    setKeys: (keys: Key[]) => void
    subscribe: (listener: () => void) => { unsubscribe: () => void }
}

const makeFakeStore = (): FakeStore => {
    let state: KeyStoreState = { keys: [], status: 'idle' } as KeyStoreState
    const listeners = new Set<() => void>()
    return {
        get state() {
            return state
        },
        setKeys(keys) {
            state = { ...state, keys }
            for (const l of listeners) l()
        },
        subscribe(listener) {
            listeners.add(listener)
            return { unsubscribe: () => listeners.delete(listener) }
        },
    }
}

let keystoreStore: FakeStore

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: mocks.getProvider,
    getKeystoreStore: () => keystoreStore,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    // Keep the real utils (passkey.ts uses toUrlSafeBase64); stub only the
    // logger so assertions stay silent.
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger: { warn: vi.fn(), error: vi.fn() },
}))

import { usePasskeysQuery } from '../usePasskeysQuery'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const passkeyKey = (
    id: string,
    metadata: Record<string, unknown>,
    type = 'hd-derived-p256',
): Key => ({ id, type, algorithm: 'P256', metadata }) as unknown as Key

const nativeCredential = (
    overrides: Partial<NativeStoredCredential>,
): NativeStoredCredential =>
    ({
        credentialId: 'native-1',
        rpId: 'webauthn.io',
        userHandle: 'user-handle',
        ...overrides,
    }) as NativeStoredCredential

describe('usePasskeysQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        keystoreStore = makeFakeStore()
        mocks.getStoredCredentials.mockResolvedValue([])
        mocks.getProvider.mockReturnValue({
            passkeyAutofill: {
                getStoredCredentials: mocks.getStoredCredentials,
            },
        })
    })

    it('projects keystore-backed P256 keys into passkeys and ignores non-passkey keys', async () => {
        keystoreStore.setKeys([
            passkeyKey('cred-a', {
                origin: 'webauthn.io',
                userHandle: 'alice',
                createdAt: 100,
            }),
            passkeyKey('hd-root', {}, 'hd-root-key'),
        ])

        const { result } = renderHook(() => usePasskeysQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.passkeys).toHaveLength(1))
        expect(result.current.passkeys[0]).toMatchObject({
            origin: 'webauthn.io',
            source: 'keystore',
        })
    })

    it('surfaces native credentials that have no matching keystore key', async () => {
        mocks.getStoredCredentials.mockResolvedValue([
            nativeCredential({ credentialId: 'native-only' }),
        ])

        const { result } = renderHook(() => usePasskeysQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.passkeys).toHaveLength(1))
        expect(result.current.passkeys[0].source).toBe('native')
    })

    it('lets the keystore-backed row win when a native credential shares its id', async () => {
        keystoreStore.setKeys([
            passkeyKey('shared-id', {
                origin: 'webauthn.io',
                userHandle: 'alice',
                createdAt: 100,
            }),
        ])
        mocks.getStoredCredentials.mockResolvedValue([
            nativeCredential({ credentialId: 'shared-id' }),
        ])

        const { result } = renderHook(() => usePasskeysQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.passkeys).toHaveLength(1))
        expect(result.current.passkeys[0].source).toBe('keystore')
    })

    it('sorts passkeys newest-first by createdAt', async () => {
        keystoreStore.setKeys([
            passkeyKey('older', {
                origin: 'webauthn.io',
                userHandle: 'alice',
                createdAt: 100,
            }),
            passkeyKey('newer', {
                origin: 'webauthn.io',
                userHandle: 'bob',
                createdAt: 200,
            }),
        ])

        const { result } = renderHook(() => usePasskeysQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.passkeys).toHaveLength(2))
        expect(result.current.passkeys.map(p => p.keyId)).toEqual([
            'newer',
            'older',
        ])
    })

    it('swallows a native-credential lookup failure and still surfaces keystore passkeys', async () => {
        keystoreStore.setKeys([
            passkeyKey('cred-a', {
                origin: 'webauthn.io',
                userHandle: 'alice',
                createdAt: 100,
            }),
        ])
        mocks.getStoredCredentials.mockRejectedValue(
            new Error('native identity store unavailable'),
        )

        const { result } = renderHook(() => usePasskeysQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.passkeys).toHaveLength(1))
        expect(result.current.isError).toBe(false)
        expect(result.current.passkeys[0].source).toBe('keystore')
    })
})
