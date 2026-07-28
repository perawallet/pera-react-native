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

// This file exercises useBidaliWebViewScreen with bidali-url.web.ts's
// balance-stamping builder standing in for the plain './bidali-url' import
// (vitest has no Metro-style platform-extension resolution, unlike the real
// web bundle, so the substitution is done explicitly via vi.mock rather than
// relying on a `.web.ts` file ever being picked up automatically). This is
// the ONLY spec that can reproduce the M8 final-review regression: the web
// url string changing after mount because it has live balances baked in,
// which re-navigates PWWebView.web's iframe mid/post Bidali checkout and
// wipes the page's paymentSent/paymentCancelled callbacks. See
// useBidaliWebViewScreen.ts for the fix (balances frozen at mount).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type {
    WalletAccount,
    AccountBalances,
} from '@perawallet/wallet-core-accounts'
import { useBidaliWebViewScreen } from '../useBidaliWebViewScreen'
import { useBidali } from '../../../hooks/useBidali'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// useBidaliClose dismisses the host sheet via useBottomSheetResult, which
// needs a bottom-sheet context this hook-only render doesn't provide.
const { mockBidaliClose } = vi.hoisted(() => ({ mockBidaliClose: vi.fn() }))
vi.mock('../../../hooks/useBidaliClose', () => ({
    useBidaliClose: () => mockBidaliClose,
}))

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
    isMainnet: (network: string) => network === 'mainnet',
}))

const { accountBalancesMock } = vi.hoisted(() => ({
    accountBalancesMock: vi.fn(() => ({
        accountBalances: new Map() as AccountBalances,
    })),
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesQuery: () => accountBalancesMock(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: (addr: string) => /^[A-Z2-7]{58}$/.test(addr ?? ''),
    useAlgorandClient: () => ({ newGroup: () => ({}) }),
    useNetwork: () => ({ network: 'mainnet' }),
    displayUnitsToBaseUnits: () => ({ toFixed: () => '0' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { decimals: 6 },
    getKnownAssetId: (key: string) => (key === 'USDC' ? '31566704' : '0'),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    ALGO_ASSET_ID: '0',
    isAlgoAssetId: (assetId: string | number | bigint) =>
        String(assetId) === '0',
    generateOrderedUniqueId: () => 'id',
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

// The web platform's balance-stamping builder, standing in for the
// extensionless './bidali-url' the hook actually imports — see the file
// banner above.
vi.mock('../bidali-url', async () => {
    const web =
        await vi.importActual<typeof import('../bidali-url.web')>(
            '../bidali-url.web',
        )
    return { buildBidaliUrl: web.buildBidaliUrl }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAccount: WalletAccount = {
    id: 'bidali-webview-web-account',
    address: VALID_ADDRESS,
    name: 'Test',
    type: 'algo25',
    keyPairId: 'test-key-pair-id',
}

const balancesWith = (algo: string, usdc: string): AccountBalances =>
    new Map([
        [
            VALID_ADDRESS,
            {
                assetBalances: [
                    {
                        assetId: '0',
                        amount: new Decimal(algo),
                        algoValue: new Decimal(algo),
                    },
                    {
                        assetId: '31566704',
                        amount: new Decimal(usdc),
                        algoValue: new Decimal(usdc),
                    },
                ],
                algoValue: new Decimal(algo),
                isPending: false,
                isFetched: true,
                isRefetching: false,
                isError: false,
            },
        ],
    ])

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBidaliWebViewScreen (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        accountBalancesMock.mockReturnValue({
            accountBalances: new Map() as AccountBalances,
        })
        const { result } = renderHook(() => useBidali())
        act(() => result.current.reset())
    })

    it('stamps the balances present at mount onto the url', () => {
        accountBalancesMock.mockReturnValue({
            accountBalances: balancesWith('10', '5'),
        })
        const { result: store } = renderHook(() => useBidali())
        act(() => store.current.setSelectedAccount(mockAccount))

        const { result } = renderHook(() => useBidaliWebViewScreen())

        expect(result.current.url).toContain('peraBidaliBalances=')
        expect(result.current.url).toContain(encodeURIComponent('"10"'))
        expect(result.current.url).toContain(encodeURIComponent('"5"'))
    })

    it('keeps the url stable across a balances update after mount (regression: M8 final review)', () => {
        accountBalancesMock.mockReturnValue({
            accountBalances: balancesWith('10', '5'),
        })
        const { result: store } = renderHook(() => useBidali())
        act(() => store.current.setSelectedAccount(mockAccount))

        const { result, rerender } = renderHook(() => useBidaliWebViewScreen())
        const urlAfterMount = result.current.url
        expect(urlAfterMount).toContain(encodeURIComponent('"10"'))

        // Simulate a post-mount balance sync — e.g. the sync the user's own
        // gift-card payment triggers — by swapping the mocked query result
        // out from under the already-mounted hook and re-rendering it.
        accountBalancesMock.mockReturnValue({
            accountBalances: balancesWith('999', '888'),
        })
        rerender()

        expect(result.current.url).toBe(urlAfterMount)
        expect(result.current.url).not.toContain('999')
        expect(result.current.url).not.toContain('888')
    })
})
