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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBidaliWebViewScreen } from '../useBidaliWebViewScreen'
import { useBidali } from '../../../hooks/useBidali'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// useBidaliClose dismisses the host sheet via useBottomSheetResult, which needs
// a bottom-sheet context this hook-only render doesn't provide — mock it to a
// stable spy so the screen hook can resolve its close handler.
const { mockBidaliClose } = vi.hoisted(() => ({ mockBidaliClose: vi.fn() }))
vi.mock('../../../hooks/useBidaliClose', () => ({
    useBidaliClose: () => mockBidaliClose,
}))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-native', () => ({
    Linking: { openURL: vi.fn() },
}))

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        bidaliApiKey: 'test-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    },
    getNetworkConfig: () => ({
        bidaliApiKey: 'test-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesQuery: () => ({ accountBalances: new Map() }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: (addr: string) => /^[A-Z2-7]{58}$/.test(addr ?? ''),
    useAlgorandClient: () => ({ newGroup: () => ({}) }),
    useNetwork: () => ({ network: 'mainnet' }),
    displayUnitsToBaseUnits: () => ({ toFixed: () => '0' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { decimals: 6 },
    ALGO_ASSET_ID: '0',
    getKnownAssetId: () => '31566704',
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    generateOrderedUniqueId: () => 'id',
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAccount: WalletAccount = {
    id: 'bidali-webview-account',
    address: VALID_ADDRESS,
    name: 'Test',
    type: 'algo25',
    keyPairId: 'test-key-pair-id',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBidaliWebViewScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        const { result } = renderHook(() => useBidali())
        act(() => result.current.reset())
    })

    describe('url construction', () => {
        it('appends API key when configured', () => {
            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.url).toBe(
                'https://commerce.bidali.com/dapp?key=test-key',
            )
        })
    })

    describe('bidaliProviderJS', () => {
        it('returns JS that sets up window.bidaliProvider', () => {
            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.bidaliProviderJS).toContain(
                'window.bidaliProvider',
            )
        })
    })

    describe('onClose', () => {
        it('exposes the Bidali close handler', () => {
            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.onClose).toBe(mockBidaliClose)
        })
    })

    describe('selectedAccount passthrough', () => {
        it('provides handleMessage and webviewRef', () => {
            const { result: store } = renderHook(() => useBidali())
            act(() => store.current.setSelectedAccount(mockAccount))

            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.handleMessage).toBeTypeOf('function')
            expect(result.current.webviewRef).toBeDefined()
        })
    })
})
