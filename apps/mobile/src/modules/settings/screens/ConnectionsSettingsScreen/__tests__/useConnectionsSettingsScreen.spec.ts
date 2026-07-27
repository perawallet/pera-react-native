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
import {
    useWalletConnect,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
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

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: vi.fn(),
}))

vi.mock('@modules/settings/hooks/useDappConnectionsStore', () => ({
    useDappConnectionsStore: vi.fn(),
}))

const walletConnectConnection: WalletConnectConnection = {
    clientId: 'client-1',
    version: 1,
    bridge: 'https://bridge.example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    session: {
        connected: true,
        accounts: [],
        chainId: 416_001,
        bridge: 'https://bridge.example.com',
        key: 'key',
        clientId: 'client-1',
        clientMeta: null,
        peerId: 'peer-1',
        peerMeta: {
            name: 'Some Dapp',
            description: '',
            url: 'https://dapp.example.com',
            icons: ['https://dapp.example.com/icon.png'],
        },
        handshakeId: 1,
        handshakeTopic: 'topic',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
}

const dappPermission: DappPermission = {
    origin: 'https://site.example.com',
    addresses: ['ADDR_A'],
    name: 'Some Site',
    iconUrl: 'https://site.example.com/icon.png',
    grantedAt: new Date('2026-02-01T00:00:00.000Z').getTime(),
}

describe('useConnectionsSettingsScreen', () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined)
    const mockRevoke = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        vi.clearAllMocks()
        mockDisconnect.mockResolvedValue(undefined)
        mockRevoke.mockResolvedValue(undefined)
        ;(useWalletConnect as Mock).mockReturnValue({
            connections: [walletConnectConnection],
            disconnect: mockDisconnect,
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
                kind: 'walletconnect',
                title: 'Some Dapp',
                subtitle: 'https://dapp.example.com',
                iconUrl: 'https://dapp.example.com/icon.png',
                connectedAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
        ])
        expect(result.current.isLoading).toBe(false)
    })

    it('exposes a stable keyExtractor unique per kind', () => {
        const { result } = renderHook(() => useConnectionsSettingsScreen())
        const [dappRow, wcRow] = result.current.connections

        expect(result.current.keyExtractor(dappRow)).toBe(dappRow.id)
        expect(result.current.keyExtractor(wcRow)).toBe(wcRow.id)
        expect(dappRow.id).not.toBe(wcRow.id)
    })

    it('returns an empty list when both sources are empty', () => {
        ;(useWalletConnect as Mock).mockReturnValue({
            connections: [],
            disconnect: mockDisconnect,
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

    it('confirms then calls disconnect with the clientId for a WalletConnect row', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useConnectionsSettingsScreen())
        const wcRow = result.current.connections.find(
            connection => connection.kind === 'walletconnect',
        )

        result.current.handleRevoke(wcRow!)

        await waitFor(() =>
            expect(mockDisconnect).toHaveBeenCalledWith('client-1', true),
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
        expect(mockDisconnect).not.toHaveBeenCalled()
    })

    it('does not revoke when the user cancels the confirm sheet', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useConnectionsSettingsScreen())
        const dappRow = result.current.connections.find(
            connection => connection.kind === 'dapp',
        )

        result.current.handleRevoke(dappRow!)

        await waitFor(() =>
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1),
        )
        expect(mockRevoke).not.toHaveBeenCalled()
        expect(mockDisconnect).not.toHaveBeenCalled()
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
