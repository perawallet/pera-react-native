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

const mockGoBack = vi.fn()
const mockSuccessToast = vi.fn()
const mockErrorToast = vi.fn()
const mockInvalidate = vi.fn()
const mockExecuteSwap = vi.fn()
const mockSwap = vi.hoisted(() => ({
    quote: null as unknown,
    isQuoteFetching: false,
    isSwapping: false,
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: { sourceAssetId: 'algo-id', amount: '5' },
    }),
    useNavigation: () => ({ goBack: mockGoBack }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'ADDR' }),
    useAccountBalancesInvalidator: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    getKnownAssetId: () => 'usdc-id',
    useAssetsQuery: () => ({
        data: new Map([
            ['usdc-id', { assetId: 'usdc-id', decimals: 6, unitName: 'USDC' }],
            ['algo-id', { assetId: 'algo-id', decimals: 6, unitName: 'ALGO' }],
        ]),
    }),
    formatAssetAmount: (
        amount: { toString: () => string },
        asset: { unitName?: string },
    ) => `${amount.toString()} ${asset.unitName ?? ''}`.trim(),
}))

vi.mock('../../CardAddFundsScreen/useCardAddFundsSwap', () => ({
    useCardAddFundsSwap: () => ({
        quote: mockSwap.quote,
        rate: null,
        usdcOut: null,
        isQuoteFetching: mockSwap.isQuoteFetching,
        isSwapping: mockSwap.isSwapping,
        executeSwap: mockExecuteSwap,
    }),
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

import { useCardConfirmSwapScreen } from '../useCardConfirmSwapScreen'

const QUOTE = {
    quoteIdStr: 'q1',
    amountIn: new Decimal('200'),
    amountOut: new Decimal('60'),
    amountOutWithSlippage: new Decimal('59'),
    price: new Decimal('0.305685'),
    slippage: new Decimal('0.005'),
    priceImpact: new Decimal('0.306'),
    transactionFees: new Decimal('0.24'),
    peraFeeAmount: new Decimal('0'),
    assetIn: { unitName: 'ALGO', decimals: 6 },
    assetOut: { unitName: 'USDC', decimals: 6 },
}

describe('useCardConfirmSwapScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSwap.quote = null
        mockSwap.isQuoteFetching = false
        mockSwap.isSwapping = false
        mockExecuteSwap.mockResolvedValue({ kind: 'success' })
    })

    it('disables Confirm and shows loading while the quote is still fetching', () => {
        mockSwap.isQuoteFetching = true
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        expect(result.current.isQuoteLoading).toBe(true)
        expect(result.current.isConfirmDisabled).toBe(true)
    })

    it('confirms the swap, toasts success, invalidates balances, and goes back', async () => {
        mockSwap.quote = QUOTE
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        expect(result.current.isConfirmDisabled).toBe(false)
        act(() => result.current.handleConfirm())

        await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
        expect(mockExecuteSwap).toHaveBeenCalled()
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockInvalidate).toHaveBeenCalled()
    })

    it('toasts the error and stays on the screen when the swap fails', async () => {
        mockSwap.quote = QUOTE
        mockExecuteSwap.mockResolvedValue({ kind: 'error', message: 'boom' })
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockGoBack).not.toHaveBeenCalled()
    })
})
