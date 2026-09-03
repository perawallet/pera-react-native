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

// The `unit` project cannot resolve `.web` files by platform extension, so —
// like `useWalletConnectSessionsControl.web.test.ts` — this imports the twin
// by its explicit path. Without it the browser extension's half of the
// settings read path ships with no coverage at all, and the two halves can
// drift on behaviour even though `UseConnectionSettingsListResult` pins their
// shape.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'

const { disconnect, deleteAllSessions, showError } = vi.hoisted(() => ({
    disconnect: vi.fn(async () => {}),
    deleteAllSessions: vi.fn(async () => {}),
    showError: vi.fn(),
}))

let connections: WalletConnectConnection[] = []

vi.mock('@modules/walletconnect/hooks/useWalletConnectSessionsControl', () => ({
    useWalletConnectSessionsControl: () => ({
        connections,
        disconnect,
        deleteAllSessions,
    }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError }),
}))

// The real chain-id rule by source path: the global mock of the package
// does not carry it, and a hand-written copy here would drift from it.
vi.mock(
    '@perawallet/wallet-core-walletconnect',
    async () =>
        await vi.importActual<
            typeof import('../../../../../../../packages/walletconnect/src/shared/chain')
        >('../../../../../../../packages/walletconnect/src/shared/chain'),
)

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useConnectionSettingsList } from '../useConnectionSettingsList.web'

const legacyConnection = (
    overrides: Partial<WalletConnectConnection> = {},
): WalletConnectConnection => ({
    clientId: 'client-1',
    version: 1,
    bridge: 'https://bridge.example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    session: {
        connected: true,
        accounts: ['ADDR_A'],
        chainId: 416_001,
        permissions: ['algo_signTxn'],
        peerMeta: {
            name: 'Some Dapp',
            description: 'desc',
            url: 'https://dapp.example.com',
            icons: ['https://dapp.example.com/icon.png'],
        },
    } as unknown as WalletConnectConnection['session'],
    ...overrides,
})

describe('useConnectionSettingsList.web', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        connections = [legacyConnection()]
    })

    it('produces the same row shape the native half does', () => {
        const { result } = renderHook(() => useConnectionSettingsList())

        expect(result.current.connections).toEqual([
            {
                id: 'client-1',
                kind: 'walletconnect-v1',
                title: 'Some Dapp',
                subtitle: 'https://dapp.example.com',
                iconUrl: 'https://dapp.example.com/icon.png',
                accounts: ['ADDR_A'],
                isConnected: true,
                createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
                lastActiveAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
                peer: {
                    name: 'Some Dapp',
                    url: 'https://dapp.example.com',
                    description: 'desc',
                    icons: ['https://dapp.example.com/icon.png'],
                },
                permissions: ['algo_signTxn'],
                networks: ['mainnet'],
                protocolVersion: 1,
            },
        ])
        // The legacy store rehydrates synchronously, so there is no window
        // in which an empty list would mean "not loaded yet".
        expect(result.current.isHydrated).toBe(true)
    })

    // 4160 is v1's "any Algorand chain" wildcard.
    it('expands the wildcard chain id to every network, like the handler does', () => {
        connections = [
            legacyConnection({
                session: {
                    ...legacyConnection().session,
                    chainId: 4160,
                } as unknown as WalletConnectConnection['session'],
            }),
        ]

        const { result } = renderHook(() => useConnectionSettingsList())

        expect(result.current.connections[0].networks).toEqual(
            expect.arrayContaining(['mainnet', 'testnet', 'betanet']),
        )
    })

    // `WalletConnectConnection.createdAt` is typed `Date` but persisted via
    // `createJSONStorage` with no reviver, so a rehydrated store hands this
    // twin an ISO *string*. `toComparableTime` is the guard; a naive
    // `.getTime()` throws the moment the store rehydrates. This is the test
    // that moved here from the unified settings screen's spec when the
    // hazard moved to this file.
    it('reads a rehydrated string timestamp without throwing', () => {
        connections = [
            legacyConnection({
                createdAt: '2026-01-01T00:00:00.000Z' as unknown as Date,
            }),
        ]

        const { result } = renderHook(() => useConnectionSettingsList())

        expect(result.current.connections[0].createdAt).toBe(
            new Date('2026-01-01T00:00:00.000Z').getTime(),
        )
    })

    it('sorts most-recently-active first, like the native half', () => {
        connections = [
            legacyConnection({
                clientId: 'older',
                lastActiveAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
            legacyConnection({
                clientId: 'newer',
                lastActiveAt: new Date('2026-03-01T00:00:00.000Z'),
            }),
        ]

        const { result } = renderHook(() => useConnectionSettingsList())

        expect(result.current.connections.map(row => row.id)).toEqual([
            'newer',
            'older',
        ])
    })

    it('falls back to the bridge and the unknown-peer label when metadata is absent', () => {
        connections = [
            legacyConnection({
                session: {
                    connected: false,
                    accounts: [],
                } as unknown as WalletConnectConnection['session'],
            }),
        ]

        const { result } = renderHook(() => useConnectionSettingsList())

        const [row] = result.current.connections
        expect(row.title).toBe('walletconnect.settings.unknown_peer')
        expect(row.subtitle).toBe('https://bridge.example.com')
        expect(row.isConnected).toBe(false)
        expect(row.permissions).toEqual([])
    })

    it('revokes by connection id and toasts a failure, like the native half', async () => {
        disconnect.mockRejectedValueOnce(new Error('no offscreen document'))
        const { result } = renderHook(() => useConnectionSettingsList())

        result.current.handleRevoke('client-1')

        expect(disconnect).toHaveBeenCalledWith('client-1')
        await waitFor(() =>
            expect(showError).toHaveBeenCalledWith(
                expect.any(Error),
                'walletconnect.settings.disconnect_failed_title',
            ),
        )
    })

    it('surfaces the awaited revoke and the sweep for callers that need them', async () => {
        const { result } = renderHook(() => useConnectionSettingsList())

        await result.current.revoke('client-1')
        await result.current.revokeAll()

        expect(disconnect).toHaveBeenCalledWith('client-1')
        expect(deleteAllSessions).toHaveBeenCalledTimes(1)
    })
})
