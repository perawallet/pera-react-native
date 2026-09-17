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
import { useConnectionSettingsList } from '@modules/settings/hooks/useConnectionSettingsList'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'

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

vi.mock('@modules/settings/hooks/useConnectionSettingsList', () => ({
    useConnectionSettingsList: vi.fn(),
}))

const walletConnectRow: ConnectionSettingsRow = {
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

const dappRow: ConnectionSettingsRow = {
    id: 'https://site.example.com',
    kind: 'dapp',
    title: 'Some Site',
    subtitle: 'https://site.example.com',
    iconUrl: 'https://site.example.com/icon.png',
    accounts: ['ADDR_A'],
    isConnected: true,
    createdAt: new Date('2026-02-01T00:00:00.000Z').getTime(),
    lastActiveAt: new Date('2026-02-01T00:00:00.000Z').getTime(),
    peer: { name: 'Some Site', url: 'https://site.example.com' },
    permissions: ['algo_signTxn'],
    networks: ['mainnet'],
}

describe('useConnectionsSettingsScreen', () => {
    const mockRevokeConnection = vi.fn()

    const mockList = (
        connections: ConnectionSettingsRow[],
        isHydrated = true,
    ) => {
        ;(useConnectionSettingsList as Mock).mockReturnValue({
            connections,
            handleRevoke: mockRevokeConnection,
            revoke: vi.fn().mockResolvedValue(undefined),
            revokeAll: vi.fn().mockResolvedValue(undefined),
            keyExtractor: (row: ConnectionSettingsRow) => row.id,
            isHydrated,
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockList([walletConnectRow, dappRow])
    })

    it('maps every registry row through toUnifiedConnection, most recent first', () => {
        const { result } = renderHook(() => useConnectionsSettingsScreen())

        expect(result.current.connections).toEqual([
            expect.objectContaining({
                id: 'connection-https://site.example.com',
                kind: 'dapp',
                title: 'Some Site',
                subtitle: 'https://site.example.com',
                connectedAt: dappRow.lastActiveAt,
            }),
            expect.objectContaining({
                id: 'connection-client-1',
                kind: 'walletconnect-v1',
                title: 'Some Dapp',
                connectedAt: walletConnectRow.lastActiveAt,
            }),
        ])
    })

    it('reports the connections mirror as not hydrated until it is, so the screen can hold its empty state', () => {
        mockList([], false)

        const { result } = renderHook(() => useConnectionsSettingsScreen())

        expect(result.current.isHydrated).toBe(false)
    })

    it('returns an empty list when the registry has no rows', () => {
        mockList([])

        const { result } = renderHook(() => useConnectionsSettingsScreen())

        expect(result.current.connections).toEqual([])
    })

    it('confirms then revokes by connection id', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useConnectionsSettingsScreen())

        result.current.handleRevoke(result.current.connections[1])

        await waitFor(() =>
            expect(mockRevokeConnection).toHaveBeenCalledWith('client-1'),
        )
    })

    // A dapp connection revokes a site's page-level access rather than a
    // paired session, so it gets the site-revoke wording.
    it('uses the site-revoke copy for a dapp connection', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useConnectionsSettingsScreen())

        result.current.handleRevoke(result.current.connections[0])

        await waitFor(() => expect(mockRequestBottomSheet).toHaveBeenCalled())
        expect(
            mockRequestBottomSheet.mock.calls[0][0].contents.props,
        ).toMatchObject({
            title: 'settings.connected_sites.revoke_title',
            message: 'settings.connected_sites.revoke_body',
            confirmLabel: 'settings.connected_sites.revoke_confirm',
            cancelLabel: 'settings.connected_sites.revoke_cancel',
        })
    })

    // The confirmation is the whole guard here: `useConnectionSettingsList`'s
    // own revoke is fire-and-forget, so a row wired straight to it would make
    // "disconnect" a single unguarded tap.
    it('does not revoke when the user cancels the confirm sheet', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useConnectionsSettingsScreen())

        result.current.handleRevoke(result.current.connections[1])

        await waitFor(() =>
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1),
        )
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
})
