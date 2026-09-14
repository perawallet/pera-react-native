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

// Imported by explicit path — the `unit` project cannot resolve `.web` files
// by platform extension.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { Connection } from '@perawallet/wallet-extension-connections'

type ErrorScope = { connectionId?: string; pairingId?: string }
type ErrorListener = (error: Error, scope?: ErrorScope) => void

const connection = (id: string): Connection => ({
    id,
    kind: 'walletconnect-v1',
    name: 'dApp',
    peer: { name: 'dApp' },
    accounts: ['AAAA'],
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
})

const errorListeners = new Set<ErrorListener>()
const fakeRegistry = {
    subscribeToErrors: (listener: ErrorListener) => {
        errorListeners.add(listener)
        return () => errorListeners.delete(listener)
    },
}
const createRemoteConnectionRegistry = vi.fn(() => fakeRegistry)

const storageListeners = new Map<string, (key: string) => void>()
const unsubscribeStorage = vi.fn()
const onLocalStorageKeyChanged = vi.fn(
    (keys: string[], listener: (key: string) => void) => {
        for (const key of keys) storageListeners.set(key, listener)
        return unsubscribeStorage
    },
)

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    onLocalStorageKeyChanged,
}))
vi.mock('@perawallet/wallet-extension-platform-chrome/remote-registry', () => ({
    createRemoteConnectionRegistry,
}))

const createWalletConnectV1Handler = vi.fn(() => ({
    kind: 'walletconnect-v1',
}))
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    createWalletConnectV1Handler,
}))

let stored: Connection[] = []
const list = vi.fn(async () => stored)
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        connections: { store: { list, subscribe: () => () => {} } },
    }),
}))

const showToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast }),
}))

const { getActiveConnectionRegistry, useConnectionsStore } =
    await import('@perawallet/wallet-core-connections')
const { useConnectionsProvider } = await import('../useConnectionsProvider.web')

describe('useConnectionsProvider.web', () => {
    beforeEach(() => {
        stored = []
        errorListeners.clear()
        storageListeners.clear()
        createRemoteConnectionRegistry.mockClear()
        createWalletConnectV1Handler.mockClear()
        onLocalStorageKeyChanged.mockClear()
        unsubscribeStorage.mockClear()
        list.mockClear()
        showToast.mockClear()
        useConnectionsStore.getState().resetState()
    })

    afterEach(() => {
        cleanup()
    })

    it('holds one remote registry over a WalletConnect v1 handler for the hook lifetime', () => {
        const { result, rerender } = renderHook(() => useConnectionsProvider())
        rerender()

        expect(result.current).toBe(fakeRegistry)
        expect(createRemoteConnectionRegistry).toHaveBeenCalledTimes(1)
        expect(createRemoteConnectionRegistry).toHaveBeenCalledWith({
            handlers: [{ kind: 'walletconnect-v1' }],
        })
    })

    // `useDeleteAllData` also runs from the duress path above the provider.
    it('publishes the registry for callers mounted above the provider', () => {
        expect(getActiveConnectionRegistry()).toBeNull()

        const { result, unmount } = renderHook(() => useConnectionsProvider())
        expect(getActiveConnectionRegistry()).toBe(result.current)

        unmount()
        expect(getActiveConnectionRegistry()).toBeNull()
    })

    it('hydrates the mirror from the persisted store', async () => {
        stored = [connection('c1')]

        renderHook(() => useConnectionsProvider())

        await waitFor(() =>
            expect(useConnectionsStore.getState().isHydrated).toBe(true),
        )
        expect(useConnectionsStore.getState().connections).toEqual([
            connection('c1'),
        ])
    })

    // The offscreen host owns the writes; this realm's store never notifies
    // its subscribers for them, so the mirror would otherwise freeze at boot.
    it('re-lists into the mirror when another realm writes the store', async () => {
        renderHook(() => useConnectionsProvider())
        await waitFor(() =>
            expect(useConnectionsStore.getState().isHydrated).toBe(true),
        )
        stored = [connection('c2')]

        const listener = storageListeners.get('kv:pera.connections.v1')
        expect(listener).toBeDefined()
        listener?.('kv:pera.connections.v1')

        await waitFor(() =>
            expect(useConnectionsStore.getState().connections).toEqual([
                connection('c2'),
            ]),
        )
    })

    it('stops watching storage on unmount', () => {
        const { unmount } = renderHook(() => useConnectionsProvider())

        unmount()

        expect(unsubscribeStorage).toHaveBeenCalledTimes(1)
    })

    // No sheet exists in a UI realm, so a scoped error must still toast
    // rather than being swallowed by a "rejecting on error" suppression.
    it('toasts a scoped registry error', () => {
        renderHook(() => useConnectionsProvider())

        for (const listener of errorListeners) {
            listener(new Error('bridge died'), { pairingId: 'client-1' })
        }

        expect(showToast).toHaveBeenCalledTimes(1)
    })
})
