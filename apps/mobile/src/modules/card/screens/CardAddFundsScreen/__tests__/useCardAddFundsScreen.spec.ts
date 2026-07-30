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

import { renderHook, act, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { CardFundingUnavailableError } from '@perawallet/wallet-core-card'

const mockComingSoon = vi.fn()
const mockSuccessToast = vi.fn()
const mockErrorToast = vi.fn()
const mockInvalidate = vi.fn()
const mockRequestSheet = vi.fn()
const mockNavigate = vi.fn()
const mockDepositMutateAsync = vi.fn()
const mockExecuteSwap = vi.fn()
const mockSwap = vi.hoisted(() => ({
    quote: null as unknown,
    rate: null as string | null,
    usdcOut: null as unknown,
    isQuoteFetching: false,
    isSwapping: false,
}))

let mockNetwork = 'mainnet'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: mockNetwork }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'ADDR', name: 'Main Account' }),
    useAccountBalancesQuery: () => ({
        accountBalances: new Map([
            [
                'ADDR',
                {
                    assetBalances: [
                        { assetId: 'usdc-id', amount: new Decimal('320.32') },
                        { assetId: 'algo-id', amount: new Decimal('10') },
                    ],
                },
            ],
        ]),
    }),
    useAccountBalancesInvalidator: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane. A
    // constant id would route straight past this hook's `=== null` guards.
    getKnownAssetId: (_key: string, network: string) =>
        network === 'mainnet' || network === 'testnet' ? 'usdc-id' : null,
    useAssetsQuery: () => ({
        data: new Map([
            ['usdc-id', { assetId: 'usdc-id', decimals: 6, unitName: 'USDC' }],
            ['algo-id', { assetId: 'algo-id', decimals: 6, unitName: 'ALGO' }],
        ]),
    }),
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useDepositToCardMutation: () => ({
            mutateAsync: mockDepositMutateAsync,
            isPending: false,
            isFundingAvailable: false,
        }),
    }
})

vi.mock('../useCardAddFundsSwap', () => ({
    useCardAddFundsSwap: () => ({
        quote: mockSwap.quote,
        rate: mockSwap.rate,
        usdcOut: mockSwap.usdcOut,
        isQuoteFetching: mockSwap.isQuoteFetching,
        isSwapping: mockSwap.isSwapping,
        executeSwap: mockExecuteSwap,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestSheet }),
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate }),
    }
})

vi.mock('../../../components/CardSelectAssetContent', () => ({
    CardSelectAssetContent: () => null,
}))

vi.mock('../../../hooks', () => ({
    useCardComingSoonToast: () => mockComingSoon,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: mockErrorToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

import { useCardAddFundsScreen } from '../useCardAddFundsScreen'

const type = (
    result: { current: ReturnType<typeof useCardAddFundsScreen> },
    keys: string[],
) => keys.forEach(key => act(() => result.current.handleKey(key)))

describe('useCardAddFundsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockNetwork = 'mainnet'
        mockSwap.quote = null
        mockSwap.rate = null
        mockSwap.usdcOut = null
        mockSwap.isQuoteFetching = false
        mockSwap.isSwapping = false
        mockDepositMutateAsync.mockRejectedValue(
            new CardFundingUnavailableError(),
        )
        mockExecuteSwap.mockResolvedValue({ kind: 'success' })
    })

    it('defaults to USDC mode using the active account and its USDC balance', () => {
        const { result } = renderHook(() => useCardAddFundsScreen())

        expect(result.current.isUsdc).toBe(true)
        expect(result.current.fundingAccount?.address).toBe('ADDR')
        expect(result.current.balanceDisplay).toBe('320.32')
        expect(result.current.rate).toBeNull()
    })

    it('enables Deposit only for a positive amount within balance', () => {
        const { result } = renderHook(() => useCardAddFundsScreen())

        expect(result.current.isDepositDisabled).toBe(true)
        type(result, ['5'])
        expect(result.current.isDepositDisabled).toBe(false)
    })

    it('USDC Deposit routes through the gated provider → coming-soon', async () => {
        const { result } = renderHook(() => useCardAddFundsScreen())
        type(result, ['5'])

        act(() => result.current.handleDeposit())

        await waitFor(() => expect(mockComingSoon).toHaveBeenCalled())
        expect(mockExecuteSwap).not.toHaveBeenCalled()
    })

    it('selecting a non-USDC asset switches to swap mode and navigates to confirm on Deposit', async () => {
        mockRequestSheet.mockResolvedValue('algo-id')
        mockSwap.quote = { quoteIdStr: 'q1' }
        const { result } = renderHook(() => useCardAddFundsScreen())

        await act(async () => {
            await result.current.onSelectAsset()
        })

        expect(result.current.isUsdc).toBe(false)
        expect(result.current.sourceAsset?.unitName).toBe('ALGO')
        expect(result.current.balanceDisplay).toBe('10.00')

        type(result, ['5'])
        expect(result.current.isDepositDisabled).toBe(false)

        act(() => result.current.handleDeposit())

        expect(mockNavigate).toHaveBeenCalledWith('CardConfirmSwap', {
            sourceAssetId: 'algo-id',
            amount: '5',
        })
        expect(mockExecuteSwap).not.toHaveBeenCalled()
    })

    it('deposits nothing on a network with no known USDC id', () => {
        // usdcAssetId is null there, so nothing is picked either: the screen
        // must not claim USDC mode, must not fire the deposit mutation, and
        // must not navigate to a confirm screen with a null source asset.
        mockNetwork = 'betanet'
        const { result } = renderHook(() => useCardAddFundsScreen())
        type(result, ['5'])

        act(() => result.current.handleDeposit())

        expect(result.current.isUsdc).toBe(false)
        expect(mockDepositMutateAsync).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('keeps Deposit disabled in swap mode until a quote resolves', async () => {
        mockRequestSheet.mockResolvedValue('algo-id')
        mockSwap.quote = null
        const { result } = renderHook(() => useCardAddFundsScreen())

        await act(async () => {
            await result.current.onSelectAsset()
        })
        type(result, ['5'])

        expect(result.current.isDepositDisabled).toBe(true)
    })
})
