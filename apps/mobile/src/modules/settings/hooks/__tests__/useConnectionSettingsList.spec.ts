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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Connection } from '@perawallet/wallet-extension-connections'
import { useConnectionsStore } from '@perawallet/wallet-core-connections'
import { useConnectionSettingsList } from '../useConnectionSettingsList'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

const mockDisconnect = vi.fn()
const mockNetworksFor = vi.fn((connection: Connection) =>
    connection.id === 'conn-a' ? ['mainnet', 'testnet'] : ['testnet'],
)
const mockMethodsFor = vi.fn((connection: Connection) =>
    connection.id === 'conn-a' ? ['algo_signTxn'] : [],
)
// Partial: the read model runs for real, the store and registry are stubbed.
vi.mock('@perawallet/wallet-core-connections', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-connections')
    >()),
    useConnectionsStore: vi.fn(),
    useConnectionRegistry: () => ({
        disconnect: mockDisconnect,
        networksFor: mockNetworksFor,
        methodsFor: mockMethodsFor,
    }),
}))

const connectionA: Connection = {
    id: 'conn-a',
    kind: 'walletconnect-v1',
    name: 'Dapp A',
    peer: {
        name: 'Dapp A',
        url: 'https://a.example.com',
        icons: ['https://a.example.com/icon.png'],
    },
    accounts: ['ADDR_A'],
    status: 'active',
    createdAt: 1000,
    lastActiveAt: 3000,
}

const connectionB: Connection = {
    id: 'conn-b',
    kind: 'walletconnect-v1',
    name: 'Dapp B',
    peer: { name: 'Dapp B', url: 'https://b.example.com' },
    accounts: ['ADDR_B'],
    status: 'inactive',
    createdAt: 500,
    lastActiveAt: 4000,
}

type StoreSnapshot = { connections: Connection[]; isHydrated: boolean }
const mockUseConnectionsStore = (
    connections: Connection[],
    isHydrated = true,
) => {
    ;(useConnectionsStore as unknown as Mock).mockImplementation(
        (selector: (state: StoreSnapshot) => unknown) =>
            selector({ connections, isHydrated }),
    )
}

describe('useConnectionSettingsList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDisconnect.mockResolvedValue(undefined)
        mockUseConnectionsStore([connectionA, connectionB])
    })

    it('maps and sorts the store connections, most-recently-active first', () => {
        const { result } = renderHook(() => useConnectionSettingsList())

        expect(result.current.connections.map(row => row.id)).toEqual([
            'conn-b',
            'conn-a',
        ])
        expect(result.current.connections[1]).toEqual(
            expect.objectContaining({
                id: 'conn-a',
                title: 'Dapp A',
                isConnected: true,
            }),
        )
    })

    // The registry's handler decides which networks a record is usable on;
    // the read path must not decode a wire chain id itself.
    it('asks the registry which networks each connection is usable on', () => {
        const { result } = renderHook(() => useConnectionSettingsList())

        const byId = Object.fromEntries(
            result.current.connections.map(row => [row.id, row.networks]),
        )
        expect(byId).toEqual({
            'conn-a': ['mainnet', 'testnet'],
            'conn-b': ['testnet'],
        })
        expect(mockNetworksFor).toHaveBeenCalledWith(connectionA)
    })

    // Same reason: the approved methods live under a kind-specific key (v1
    // `permissions`, v2 `methods`), so only the handler can read them.
    it('asks the registry which methods each connection was approved for', () => {
        const { result } = renderHook(() => useConnectionSettingsList())

        const byId = Object.fromEntries(
            result.current.connections.map(row => [row.id, row.permissions]),
        )
        expect(byId).toEqual({
            'conn-a': ['algo_signTxn'],
            'conn-b': [],
        })
        expect(mockMethodsFor).toHaveBeenCalledWith(connectionA)
    })

    it('reports whether the mirror has hydrated, so an empty list is not mistaken for no connections', () => {
        mockUseConnectionsStore([], false)

        const { result } = renderHook(() => useConnectionSettingsList())

        expect(result.current.connections).toEqual([])
        expect(result.current.isHydrated).toBe(false)
    })

    it('exposes a keyExtractor keyed on the connection id', () => {
        const { result } = renderHook(() => useConnectionSettingsList())
        const [row] = result.current.connections

        expect(result.current.keyExtractor(row)).toBe(row.id)
    })

    it('revokes through registry.disconnect', async () => {
        const { result } = renderHook(() => useConnectionSettingsList())

        result.current.handleRevoke('conn-a')

        await waitFor(() =>
            expect(mockDisconnect).toHaveBeenCalledWith('conn-a'),
        )
        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('surfaces a toast when registry.disconnect rejects', async () => {
        const error = new Error('peer unreachable')
        mockDisconnect.mockRejectedValueOnce(error)
        const { result } = renderHook(() => useConnectionSettingsList())

        result.current.handleRevoke('conn-a')

        await waitFor(() =>
            expect(mockShowError).toHaveBeenCalledWith(
                error,
                'walletconnect.settings.disconnect_failed_title',
            ),
        )
    })

    it('returns an empty list when the store has no connections', () => {
        mockUseConnectionsStore([])

        const { result } = renderHook(() => useConnectionSettingsList())

        expect(result.current.connections).toEqual([])
    })
})
