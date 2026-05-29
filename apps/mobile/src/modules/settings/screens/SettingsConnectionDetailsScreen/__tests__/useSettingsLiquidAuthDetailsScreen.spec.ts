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
import { renderHook, act } from '@testing-library/react'
import { useLiquidAuthStore } from '@perawallet/wallet-core-liquid-auth'
import { useLiquidAuthConnect } from '@modules/connections/liquid-auth/hooks/useLiquidAuthConnect'
import { useSettingsLiquidAuthDetailsScreen } from '../useSettingsLiquidAuthDetailsScreen'

const goBack = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(() => ({ goBack })),
}))

vi.mock('@perawallet/wallet-core-liquid-auth', () => ({
    useLiquidAuthStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@modules/connections/liquid-auth/hooks/useLiquidAuthConnect', () => ({
    useLiquidAuthConnect: vi.fn(),
}))

// The hook's `handleOpenLink` pulls in useWebView; stub it so the test doesn't
// drag in the bottom-sheet/navigation graph.
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
    })),
}))

const SESSION = {
    sessionId: 'liquid-session-42',
    requestId: 'req-42',
    host: 'https://debug.liquidauth.com',
    peerMeta: {
        name: 'Liquid dApp',
        origin: 'https://app.example.com',
        icon: 'https://app.example.com/icon.png',
    },
    accounts: ['ADDR_X'],
    genesisHash: 'hash',
    networks: [],
    credentialId: 'cred-42',
    createdAt: 1_700_000_000_000,
    lastActiveAt: 1_700_000_000_000,
    ttl: 1_000,
}

describe('useSettingsLiquidAuthDetailsScreen', () => {
    const disconnect = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useLiquidAuthStore).mockImplementation((selector: any) =>
            selector({ sessions: [SESSION] }),
        )
        vi.mocked(useLiquidAuthConnect).mockReturnValue({
            connect: vi.fn(),
            disconnect,
        } as any)
    })

    it('resolves the session from the store by sessionId', () => {
        const { result } = renderHook(() =>
            useSettingsLiquidAuthDetailsScreen('liquid-session-42'),
        )

        expect(result.current.session).toEqual(SESSION)
    })

    it('returns undefined session when no matching sessionId exists', () => {
        const { result } = renderHook(() =>
            useSettingsLiquidAuthDetailsScreen('not-a-real-id'),
        )

        expect(result.current.session).toBeUndefined()
    })

    it('handleDelete calls disconnect with the sessionId and navigates back', () => {
        const { result } = renderHook(() =>
            useSettingsLiquidAuthDetailsScreen('liquid-session-42'),
        )

        act(() => {
            result.current.handleDelete()
        })

        expect(disconnect).toHaveBeenCalledWith('liquid-session-42')
        expect(goBack).toHaveBeenCalled()
    })
})
