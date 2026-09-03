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
import { renderHook } from '@testing-library/react'
import type { ConnectionsStore } from '@perawallet/wallet-core-connections'
import type { Connection } from '@perawallet/wallet-extension-connections'

// The real store shape, hand-mounted so this spec does not load the package
// barrel; typed against the package so a shape change here fails to compile.
vi.mock('@perawallet/wallet-core-connections', async () => {
    const { create } =
        await vi.importActual<typeof import('zustand')>('zustand')
    return {
        useConnectionsStore: create<ConnectionsStore>(set => ({
            connections: [],
            isHydrated: false,
            setConnections: connections =>
                set({ connections, isHydrated: true }),
            resetState: () => set({ connections: [], isHydrated: false }),
        })),
    }
})

const { useConnectionsStore } =
    await import('@perawallet/wallet-core-connections')
const { useMultisigPeerLiveness } = await import('../useMultisigPeerLiveness')

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

describe('useMultisigPeerLiveness', () => {
    beforeEach(() => {
        useConnectionsStore.getState().resetState()
    })

    it('reports a peer alive only while the connections store holds its id', () => {
        useConnectionsStore
            .getState()
            .setConnections([connection('client-1'), connection('client-2')])

        const { result } = renderHook(() => useMultisigPeerLiveness())

        expect(result.current('client-1')).toBe(true)
        expect(result.current('client-9')).toBe(false)
    })

    it('reads the store per call rather than closing over a snapshot', () => {
        useConnectionsStore.getState().setConnections([connection('client-1')])
        const { result } = renderHook(() => useMultisigPeerLiveness())

        useConnectionsStore.getState().setConnections([connection('client-2')])

        expect(result.current('client-1')).toBe(false)
        expect(result.current('client-2')).toBe(true)
    })

    // A dead answer cancels the user's sign request outright, so before the
    // mirror has hydrated the only safe answer is alive.
    it('reports alive while the mirror has not hydrated yet', () => {
        const { result } = renderHook(() => useMultisigPeerLiveness())

        expect(result.current('client-1')).toBe(true)
    })

    it('reports dead for an unknown peer once hydrated, even with no connections at all', () => {
        useConnectionsStore.getState().setConnections([])
        const { result } = renderHook(() => useMultisigPeerLiveness())

        expect(result.current('client-1')).toBe(false)
    })
})
