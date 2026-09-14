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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useConnectionsSettingsScreen } from '../useConnectionsSettingsScreen'
import { useDappConnectionsStore } from '@modules/settings/hooks/useDappConnectionsStore'
import { useConnectionSettingsList } from '@modules/settings/hooks/useConnectionSettingsList'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'
import type { DappPermission } from '@perawallet/wallet-extension-platform-chrome'

const mockRequestBottomSheet = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@modules/settings/hooks/useConnectionSettingsList', () => ({
    useConnectionSettingsList: vi.fn(),
}))

vi.mock('@modules/settings/hooks/useDappConnectionsStore', () => ({
    useDappConnectionsStore: vi.fn(),
}))

const connectionRow: ConnectionSettingsRow = {
    id: 'client-1',
    kind: 'walletconnect-v1',
    title: 'Some Dapp',
    subtitle: 'https://dapp.example.com',
    iconUrl: 'https://dapp.example.com/icon.png',
    accounts: ['ADDR_A'],
    isConnected: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    lastActiveAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    peer: { name: 'Some Dapp', url: 'https://dapp.example.com' },
    permissions: ['algo_signTxn'],
    networks: ['mainnet'],
    protocolVersion: 1,
}

const dappPermission: DappPermission = {
    origin: 'https://site.example.com',
    addresses: ['ADDR_A'],
    name: 'Some Site',
    iconUrl: 'https://site.example.com/icon.png',
    grantedAt: new Date('2026-02-01T00:00:00.000Z').getTime(),
}

describe('useConnectionsSettingsScreen', () => {
    const mockRevokeConnection = vi.fn()
    const mockRevoke = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        vi.clearAllMocks()
        mockRevoke.mockResolvedValue(undefined)
        ;(useConnectionSettingsList as Mock).mockReturnValue({
            connections: [connectionRow],
            handleRevoke: mockRevokeConnection,
            revoke: vi.fn().mockResolvedValue(undefined),
            revokeAll: vi.fn().mockResolvedValue(undefined),
            keyExtractor: (row: ConnectionSettingsRow) => row.id,
            isHydrated: true,
        })
        ;(useDappConnectionsStore as Mock).mockReturnValue({
            sites: [dappPermission],
            isLoading: false,
            refetch: vi.fn(),
            revoke: mockRevoke,
        })
    })

    it('merges and sorts both sources into UnifiedConnection[], most recent first', () => {
        const { result } = renderHook(() => useConnectionsSettingsScreen())

        expect(result.current.connections).toEqual([
            expect.objectContaining({
                kind: 'dapp',
                title: 'Some Site',
                subtitle: 'https://site.example.com',
                iconUrl: 'https://site.example.com/icon.png',
                connectedAt: new Date('2026-02-01T00:00:00.000Z'),
            }),
            expect.objectContaining({
                kind: 'walletconnect-v1',
                title: 'Some Dapp',
                subtitle: 'https://dapp.example.com',
                iconUrl: 'https://dapp.example.com/icon.png',
                connectedAt: connectionRow.lastActiveAt,
            }),
        ])
        expect(result.current.isLoading).toBe(false)
    })

    it('reports the connections mirror as not hydrated until it is, so the screen can hold its empty state', () => {
        ;(useConnectionSettingsList as Mock).mockReturnValue({
            connections: [],
            handleRevoke: mockRevokeConnection,
            revoke: vi.fn().mockResolvedValue(undefined),
            revokeAll: vi.fn().mockResolvedValue(undefined),
            keyExtractor: (row: ConnectionSettingsRow) => row.id,
            isHydrated: false,
        })

        const { result } = renderHook(() => useConnectionsSettingsScreen())

        expect(result.current.isHydrated).toBe(false)
    })

    it('exposes a stable keyExtractor unique per kind', () => {
        const { result } = renderHook(() => useConnectionsSettingsScreen())
        const [dappRow, wcRow] = result.current.connections

        expect(result.current.keyExtractor(dappRow)).toBe(dappRow.id)
        expect(result.current.keyExtractor(wcRow)).toBe(wcRow.id)
        expect(dappRow.id).not.toBe(wcRow.id)
    })

    it('returns an empty list when both sources are empty', () => {
        ;(useConnectionSettingsList as Mock).mockReturnValue({
            connections: [],
            handleRevoke: mockRevokeConnection,
            revoke: vi.fn().mockResolvedValue(undefined),
            revokeAll: vi.fn().mockResolvedValue(undefined),
            keyExtractor: (row: ConnectionSettingsRow) => row.id,
            isHydrated: true,
        })
        ;(useDappConnectionsStore as Mock).mockReturnValue({
            sites: [],
            isLoading: false,
            refetch: vi.fn(),
            revoke: mockRevoke,
        })

        const { result } = renderHook(() => useConnectionsSettingsScreen())

        expect(result.current.connections).toEqual([])
    })

    it('confirms then revokes by connection id for a connection row', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useConnectionsSettingsScreen())
        const wcRow = result.current.connections.find(
            connection => connection.kind === 'walletconnect-v1',
        )

        result.current.handleRevoke(wcRow!)

        await waitFor(() =>
            expect(mockRevokeConnection).toHaveBeenCalledWith('client-1'),
        )
        expect(mockRevoke).not.toHaveBeenCalled()
    })

    it('confirms then calls revoke with the origin for a dapp row', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useConnectionsSettingsScreen())
        const dappRow = result.current.connections.find(
            connection => connection.kind === 'dapp',
        )

        result.current.handleRevoke(dappRow!)

        await waitFor(() =>
            expect(mockRevoke).toHaveBeenCalledWith('https://site.example.com'),
        )
        expect(mockRevokeConnection).not.toHaveBeenCalled()
    })

    // The confirmation is the whole guard here: `useConnectionSettingsList`'s
    // own revoke is fire-and-forget, so a row wired straight to it would make
    // "disconnect" a single unguarded tap.
    it('does not revoke when the user cancels the confirm sheet', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useConnectionsSettingsScreen())
        const wcRow = result.current.connections.find(
            connection => connection.kind === 'walletconnect-v1',
        )

        result.current.handleRevoke(wcRow!)

        await waitFor(() =>
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1),
        )
        expect(mockRevoke).not.toHaveBeenCalled()
        expect(mockRevokeConnection).not.toHaveBeenCalled()
    })

    it('exposes scannerState for the WalletConnect QR-pairing flow', () => {
        const { result } = renderHook(() => useConnectionsSettingsScreen())

        expect(result.current.scannerState.isOpen).toBe(false)

        act(() => {
            result.current.scannerState.open()
        })

        expect(result.current.scannerState.isOpen).toBe(true)
    })

    it('reports a failed dapp revoke instead of swallowing it', async () => {
        const error = new Error('storage failure')
        mockRevoke.mockRejectedValue(error)

        const { result } = renderHook(() => useConnectionsSettingsScreen())

        const dappEntry = result.current.connections.find(
            connection => connection.kind === 'dapp',
        )

        await act(async () => {
            dappEntry?.onRevoke()
        })

        await waitFor(() =>
            expect(mockShowError).toHaveBeenCalledWith(
                error,
                'common.error.title',
            ),
        )
    })
})
