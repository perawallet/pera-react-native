/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import { useLiquidAuthStore } from '@perawallet/wallet-core-liquid-auth'
import { useLiquidAuthEnabled } from '@modules/connections/liquid-auth/hooks/useLiquidAuthEnabled'
import { useSettingsConnectedAppsScreen } from '../useSettingsConnectedAppsScreen'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => ({ network: 'testnet' })),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-liquid-auth', () => ({
    useLiquidAuthStore: vi.fn(),
}))

vi.mock('@modules/connections/liquid-auth/hooks/useLiquidAuthEnabled', () => ({
    useLiquidAuthEnabled: vi.fn(),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
    })),
}))

const WC_CONNECTIONS = [
    {
        clientId: 'wc-1',
        version: 1,
        session: {
            accounts: ['ADDR_A'],
            peerMeta: {
                name: 'Tinyman',
                url: 'https://tinyman.org',
                icons: [],
            },
        },
        createdAt: new Date('2025-01-01'),
    },
    {
        clientId: 'wc-2',
        version: 1,
        session: {
            accounts: ['ADDR_B'],
            peerMeta: {
                name: 'Pact',
                url: 'https://pact.fi',
                icons: ['https://pact.fi/icon.png'],
            },
        },
        createdAt: new Date('2025-02-01'),
    },
]

const LIQUID_SESSIONS = [
    {
        sessionId: 'liquid-1',
        requestId: 'req-1',
        host: 'https://debug.liquidauth.com',
        peerMeta: {
            name: 'Liquid dApp',
            origin: 'https://app.example.com',
            icon: 'https://app.example.com/icon.png',
        },
        accounts: ['ADDR_C'],
        genesisHash: 'hash',
        networks: [],
        credentialId: 'cred-1',
        createdAt: 1_700_000_000_000,
        lastActiveAt: 1_700_000_000_000,
        ttl: 1_000,
    },
]

describe('useSettingsConnectedAppsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useWalletConnect).mockReturnValue({
            connections: WC_CONNECTIONS as any,
            deleteAllSessions: vi.fn().mockResolvedValue(undefined),
        } as any)
        vi.mocked(useLiquidAuthStore).mockImplementation((selector: any) =>
            selector({ sessions: LIQUID_SESSIONS }),
        )
    })

    it('returns only walletconnect summaries when liquid auth is disabled', () => {
        vi.mocked(useLiquidAuthEnabled).mockReturnValue(false)

        const { result } = renderHook(() => useSettingsConnectedAppsScreen())

        expect(result.current.summaries).toHaveLength(2)
        expect(
            result.current.summaries.every(s => s.type === 'walletconnect'),
        ).toBe(true)
        expect(result.current.summaries.map(s => s.id)).toEqual([
            'wc-1',
            'wc-2',
        ])
    })

    it('returns both walletconnect and liquidauth summaries when liquid auth is enabled', () => {
        vi.mocked(useLiquidAuthEnabled).mockReturnValue(true)

        const { result } = renderHook(() => useSettingsConnectedAppsScreen())

        expect(result.current.summaries).toHaveLength(3)
        const types = result.current.summaries.map(s => s.type)
        expect(types.filter(t => t === 'walletconnect')).toHaveLength(2)
        expect(types.filter(t => t === 'liquidauth')).toHaveLength(1)
        expect(
            result.current.summaries.find(s => s.id === 'liquid-1'),
        ).toBeDefined()
    })

    it('reports hasConnections based on the connections array', () => {
        vi.mocked(useLiquidAuthEnabled).mockReturnValue(false)

        const { result } = renderHook(() => useSettingsConnectedAppsScreen())

        expect(result.current.hasConnections).toBe(true)
    })

    it('hasConnections is false when there are no connections', () => {
        vi.mocked(useLiquidAuthEnabled).mockReturnValue(false)
        vi.mocked(useWalletConnect).mockReturnValue({
            connections: [] as any,
            deleteAllSessions: vi.fn().mockResolvedValue(undefined),
        } as any)

        const { result } = renderHook(() => useSettingsConnectedAppsScreen())

        expect(result.current.hasConnections).toBe(false)
    })
})
