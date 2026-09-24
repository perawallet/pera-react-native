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
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'

const mockGoBack = vi.fn()
const mockPop = vi.fn()
const mockSuccessToast = vi.fn()
const mockErrorToast = vi.fn()
const mockInvalidate = vi.fn()
const mockExecuteSwap = vi.fn()
const mockRefreshQuote = vi.fn()
const mockInfoToast = vi.fn()
const mockDeposit = vi.fn()
const mockReadBalance = vi.fn()
const mockWaitCredit = vi.fn()
const mockDepositError = vi.fn()
const mockSwap = vi.hoisted(() => ({
    quote: null as unknown,
    isQuoteFetching: false,
    isSwapping: false,
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: { sourceAssetId: 'algo-id', amount: '5' },
    }),
    useNavigation: () => ({ goBack: mockGoBack, pop: mockPop }),
}))

let mockNetwork = 'mainnet'

// Captures what the screen hands the swap hook, so the "no known USDC id"
// branch can be asserted on the `enabled` flag it computes.
const mockSwapParams = vi.hoisted(() => ({
    current: undefined as { enabled: boolean; usdcAssetId: string } | undefined,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: mockNetwork }),
    baseUnitsToDisplayUnits: (amount: bigint, decimals: number) =>
        new Decimal(amount.toString()).div(new Decimal(10).pow(decimals)),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesInvalidator: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('../../../hooks', () => ({
    useCardFundingAccount: () => ({ address: 'ADDR' }),
    useCardManualDeposit: () => ({ deposit: mockDeposit, isDepositing: false }),
    useCardErrorToast: () => mockDepositError,
}))

vi.mock('@perawallet/wallet-core-card', () => ({
    useCardUsdcCreditQuery: () => ({
        readUsdcBalance: mockReadBalance,
        waitForUsdcCredit: mockWaitCredit,
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane, so
    // the hook's `usdcAssetId !== null` gate is actually reachable here.
    getKnownAssetId: (_key: string, network: string) =>
        network === 'mainnet' || network === 'testnet' ? 'usdc-id' : null,
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
    useCardAddFundsSwap: (params: {
        enabled: boolean
        usdcAssetId: string
    }) => {
        mockSwapParams.current = params
        return {
            quote: mockSwap.quote,
            rate: null,
            usdcOut: null,
            isQuoteFetching: mockSwap.isQuoteFetching,
            isSwapping: mockSwap.isSwapping,
            executeSwap: mockExecuteSwap,
            refreshQuote: mockRefreshQuote,
        }
    },
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
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
        mockNetwork = 'mainnet'
        mockSwapParams.current = undefined
        mockSwap.quote = null
        mockSwap.isQuoteFetching = false
        mockSwap.isSwapping = false
        mockExecuteSwap.mockResolvedValue({ kind: 'success' })
        mockReadBalance.mockResolvedValue(1_000_000n)
        mockWaitCredit.mockResolvedValue(60_000_000n)
        mockDeposit.mockResolvedValue({ txIds: ['DEP'] })
        mockDepositError.mockResolvedValue(undefined)
    })

    it('keeps the swap disabled when the network has no known USDC id', () => {
        mockNetwork = 'betanet'
        renderHook(() => useCardConfirmSwapScreen())

        // Nothing to swap INTO there, so the quote must never be requested.
        expect(mockSwapParams.current).toMatchObject({
            enabled: false,
            usdcAssetId: '',
        })
    })

    it('enables the swap on a network that has a known USDC id', () => {
        renderHook(() => useCardConfirmSwapScreen())

        expect(mockSwapParams.current).toMatchObject({
            enabled: true,
            usdcAssetId: 'usdc-id',
        })
    })

    it('lists both steps as pending before anything is confirmed', () => {
        mockSwap.quote = QUOTE
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        expect(result.current.steps).toEqual([
            { id: 'swap', stepNumber: 1, status: 'pending', isBusy: false },
            { id: 'deposit', stepNumber: 2, status: 'pending', isBusy: false },
        ])
    })

    it('disables Confirm and shows loading while the quote is still fetching', () => {
        mockSwap.isQuoteFetching = true
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        expect(result.current.isQuoteLoading).toBe(true)
        expect(result.current.isConfirmDisabled).toBe(true)
    })

    it('swaps, waits for the USDC to land, deposits exactly that, and goes back', async () => {
        mockSwap.quote = QUOTE
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        expect(result.current.isConfirmDisabled).toBe(false)
        act(() => result.current.handleConfirm())

        // Both Add Funds and Confirm are popped, straight back to the card.
        await waitFor(() => expect(mockPop).toHaveBeenCalledWith(2))
        expect(mockExecuteSwap).toHaveBeenCalled()
        // The balance is snapshotted before the swap; the wait needs at least
        // the quote's guaranteed minimum on top of it.
        expect(mockReadBalance).toHaveBeenCalledWith('ADDR')
        expect(mockWaitCredit).toHaveBeenCalledWith({
            address: 'ADDR',
            before: 1_000_000n,
            minimum: 59n,
        })
        const [{ amount }] = mockDeposit.mock.calls[0] as [{ amount: Decimal }]
        expect(amount.toFixed(2)).toBe('60.00')
        expect(mockSuccessToast).toHaveBeenCalledWith(
            'peraCard.add_funds.deposit_success_title',
            'peraCard.add_funds.swap_deposit_success_body',
        )
        expect(mockInvalidate).toHaveBeenCalled()
        expect(result.current.step).toBe('idle')
    })

    it('keeps the screen with a retry when the deposit fails after a good swap', async () => {
        mockSwap.quote = QUOTE
        mockDeposit.mockRejectedValueOnce(new Error('escrow rejected'))
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(result.current.step).toBe('deposit-failed'))
        expect(mockDepositError).toHaveBeenCalledTimes(1)
        expect(mockPop).not.toHaveBeenCalled()
        // The swap is kept as done so only the deposit reads as the problem.
        expect(result.current.steps.map(row => row.status)).toEqual([
            'done',
            'failed',
        ])

        act(() => result.current.handleRetryDeposit())

        await waitFor(() => expect(mockPop).toHaveBeenCalledWith(2))
        // The credited amount is remembered, so the retry deposits without
        // re-running the swap or the wait.
        expect(mockExecuteSwap).toHaveBeenCalledTimes(1)
        expect(mockWaitCredit).toHaveBeenCalledTimes(1)
        expect(mockDeposit).toHaveBeenCalledTimes(2)
    })

    it('treats a declined deposit review as a quiet stop, not an error', async () => {
        mockSwap.quote = QUOTE
        mockDeposit.mockRejectedValueOnce(new UserRejectedSigningError())
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(result.current.step).toBe('deposit-failed'))
        expect(mockDepositError).not.toHaveBeenCalled()
    })

    it('offers the deposit again when the USDC has not shown up in time', async () => {
        mockSwap.quote = QUOTE
        mockWaitCredit.mockRejectedValueOnce(new Error('timed out'))
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(result.current.step).toBe('deposit-failed'))
        expect(mockDeposit).not.toHaveBeenCalled()
        expect(mockDepositError).toHaveBeenCalledTimes(1)
    })

    it('refreshes an expired quote and asks for another confirm', async () => {
        mockSwap.quote = QUOTE
        mockExecuteSwap.mockResolvedValue({ kind: 'stale-quote' })
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(mockRefreshQuote).toHaveBeenCalled())
        expect(mockInfoToast).toHaveBeenCalledWith(
            'swap.quote.refreshed_title',
            'swap.quote.refreshed_body',
        )
        expect(result.current.step).toBe('idle')
        expect(mockGoBack).not.toHaveBeenCalled()
    })

    it('toasts the error and stays on the screen when the swap fails', async () => {
        mockSwap.quote = QUOTE
        mockExecuteSwap.mockResolvedValue({ kind: 'error', message: 'boom' })
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockGoBack).not.toHaveBeenCalled()
    })

    // F1: a submission-phase failure (e.g. the honest unknown-outcome
    // headline) must reach the toast title instead of always rendering the
    // generic "swap failed" copy.
    it('uses the resolved title on the error toast when one is present', async () => {
        mockSwap.quote = QUOTE
        mockExecuteSwap.mockResolvedValue({
            kind: 'error',
            message: 'boom',
            title: 'resolved.title',
        })
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockErrorToast).toHaveBeenCalledWith('resolved.title', 'boom')
    })

    it('falls back to the default title when the outcome carries none', async () => {
        mockSwap.quote = QUOTE
        mockExecuteSwap.mockResolvedValue({ kind: 'error', message: 'boom' })
        const { result } = renderHook(() => useCardConfirmSwapScreen())

        act(() => result.current.handleConfirm())

        await waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockErrorToast).toHaveBeenCalledWith(
            'peraCard.add_funds.swap_error_title',
            'boom',
        )
    })
})
