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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useSwapForm } from '../useSwapForm'
import type { Nullable } from '@perawallet/wallet-core-shared'

const mockSetFromAsset = vi.fn()
const mockSetToAsset = vi.fn()
const mockSetSlippage = vi.fn()
const mockResetQuoteMutation = vi.fn()
const mockCreateQuotes = vi.fn()
const mockCalculateSwapAmount = vi.fn()
const mockSetIsLocalCurrencyInput = vi.fn()
const mockResetAssetPair = vi.fn()
const mockInfoToast = vi.fn()
const mockErrorToast = vi.fn()

// Captured so a test can run the cleanup React Navigation would run on blur.
let focusEffectCleanup: Nullable<() => void> = null
vi.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => () => void) => {
        focusEffectCleanup = effect()
    },
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
        showToast: vi.fn(),
    }),
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

let mockFromAsset = '0'
let mockToAsset = '31566704'
let mockSlippage: Nullable<string> = null

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({
        fromAsset: mockFromAsset,
        toAsset: mockToAsset,
        slippage: mockSlippage,
        isLocalCurrencyInput: false,
        setFromAsset: mockSetFromAsset,
        setToAsset: mockSetToAsset,
        setSlippage: mockSetSlippage,
        setIsLocalCurrencyInput: mockSetIsLocalCurrencyInput,
        resetAssetPair: mockResetAssetPair,
    }),
    useCreateQuotesMutation: () => ({
        mutateAsync: mockCreateQuotes,
        isPending: false,
        isError: false,
        reset: mockResetQuoteMutation,
    }),
    useCalculateSwapAmountMutation: () => ({
        mutateAsync: mockCalculateSwapAmount,
    }),
    usePrefetchProviders: () => vi.fn(),
    percentToApiSlippage: (percent: string) =>
        new Decimal(percent).div(100).toString(),
}))

let mockSelectedAccount: { address: string } = { address: 'TESTADDRESS123' }
let mockPayBalance: Nullable<Decimal> = new Decimal('5000000')
let mockIsPayBalanceFetched = true
let mockIsPayBalanceError = false
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => mockSelectedAccount,
    useAccountAssetBalanceQuery: () => ({
        data: mockPayBalance ? { amount: mockPayBalance } : null,
        isFetched: mockIsPayBalanceFetched,
        isError: mockIsPayBalanceError,
    }),
    useAccountBalancesInvalidator: () => ({
        invalidate: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: () => ({
        data: new Map([
            [
                '0',
                {
                    assetId: '0',
                    name: 'Algorand',
                    unitName: 'ALGO',
                    decimals: 6,
                },
            ],
            [
                '123',
                {
                    assetId: '123',
                    name: 'Test Asset',
                    unitName: 'TEST',
                    decimals: 2,
                },
            ],
            [
                '456',
                {
                    assetId: '456',
                    name: 'Other Asset',
                    unitName: 'OTHR',
                    decimals: 6,
                },
            ],
            [
                '31566704',
                {
                    assetId: '31566704',
                    name: 'USD Coin',
                    unitName: 'USDC',
                    decimals: 6,
                },
            ],
        ]),
        isFetched: true,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    useNetworkStore: { getState: () => ({ network: 'mainnet' }) },
    baseUnitsToDisplayUnits: (amount: Decimal, decimals: number) =>
        amount.div(Decimal.pow(10, decimals)),
    displayUnitsToBaseUnits: (amount: Decimal, decimals: number) =>
        amount.mul(Decimal.pow(10, decimals)),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'test-device-id',
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: () => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../SwapAssetSelectionContent', () => ({
    SwapAssetSelectionContent: () => null,
}))

vi.mock('../../SwapConfigurationContent', () => ({
    SwapConfigurationContent: () => null,
}))

vi.mock('../../SwapProviderContent', () => ({
    SwapProviderContent: () => null,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    ALGO_ASSET_NAME: 'ALGO',
    isAlgoAssetName: (value: string) => value === 'ALGO',
    isDecimalEqual: (a: Nullable<Decimal>, b: Nullable<Decimal>) => {
        if (a === b) return true
        if (a === null || b === null) return false
        return a.equals(b)
    },
    useDebouncedValue: (value: unknown) => value,
    uint64IdToNumber: (id: string | number) => Number(id),
}))

vi.mock('../../SwapConfirmationContent', () => ({
    SwapConfirmationContent: () => null,
}))

describe('useSwapForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFromAsset = '0'
        mockToAsset = '31566704'
        mockSlippage = null
        mockSelectedAccount = { address: 'TESTADDRESS123' }
        mockPayBalance = new Decimal('5000000')
        mockIsPayBalanceFetched = true
        mockIsPayBalanceError = false
        focusEffectCleanup = null
    })

    it('initializes with null amounts and canSwap false', () => {
        const { result } = renderHook(() => useSwapForm())

        expect(result.current.payAmount).toBeNull()
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(result.current.canSwap).toBe(false)
    })

    it('returns asset IDs from swap store', () => {
        const { result } = renderHook(() => useSwapForm())

        expect(result.current.payAssetId).toBe('0')
        expect(result.current.receiveAssetId).toBe('31566704')
    })

    it('handlePayAmountChange updates payAmount', () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(result.current.payAmount).toEqual(new Decimal(5))
    })

    it('handleSwapDirection swaps assets and amounts', () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handlePayAmountChange(new Decimal(10))
        })

        act(() => {
            result.current.handleSwapDirection()
        })

        expect(mockSetFromAsset).toHaveBeenCalledWith('31566704')
        expect(mockSetToAsset).toHaveBeenCalledWith('0')
        expect(mockResetQuoteMutation).toHaveBeenCalled()
    })

    it('handleOpenPayAssetSelection preserves pay amount and clears receive amount and quote when an asset is picked', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('123')
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        await act(async () => {
            await result.current.handleOpenPayAssetSelection()
        })

        expect(mockSetFromAsset).toHaveBeenCalledWith('123')
        expect(result.current.payAmount).toEqual(new Decimal(5))
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(mockResetQuoteMutation).toHaveBeenCalled()
    })

    it('handleOpenPayAssetSelection no-ops when picker is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenPayAssetSelection()
        })

        expect(mockSetFromAsset).not.toHaveBeenCalled()
    })

    it('handleOpenPayAssetSelection triggers quote re-fetch when pay amount exists', async () => {
        mockCreateQuotes.mockResolvedValue([])
        mockRequestBottomSheet.mockResolvedValueOnce('123')

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)

        mockFromAsset = '123'
        await act(async () => {
            await result.current.handleOpenPayAssetSelection()
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(2)
    })

    it('handleOpenReceiveAssetSelection triggers quote re-fetch when pay amount exists', async () => {
        mockCreateQuotes.mockResolvedValue([])
        mockRequestBottomSheet.mockResolvedValueOnce('456')

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)

        mockToAsset = '456'
        await act(async () => {
            await result.current.handleOpenReceiveAssetSelection()
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(2)
    })

    it('handleOpenReceiveAssetSelection clears receive amount and quote when an asset is picked', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('456')
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenReceiveAssetSelection()
        })

        expect(mockSetToAsset).toHaveBeenCalledWith('456')
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(mockResetQuoteMutation).toHaveBeenCalled()
    })

    it('handleOpenReceiveAssetSelection no-ops when picker is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenReceiveAssetSelection()
        })

        expect(mockSetToAsset).not.toHaveBeenCalled()
    })

    it('handleMaxPress calls calculateSwapAmount with 100% percentage', async () => {
        mockCalculateSwapAmount.mockResolvedValueOnce({
            amount: new Decimal('5000000'),
        })

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handleMaxPress()
        })

        expect(mockCalculateSwapAmount).toHaveBeenCalledWith(
            expect.objectContaining({
                percentage: '1',
                address: 'TESTADDRESS123',
            }),
        )
    })

    it('tells the user instead of filling 0 when the calculated max is zero', async () => {
        mockCalculateSwapAmount.mockResolvedValueOnce({
            amount: new Decimal(0),
        })

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handleMaxPress()
        })

        expect(mockCalculateSwapAmount).toHaveBeenCalled()
        expect(result.current.payAmount).toBeNull()
        expect(mockInfoToast).toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('tells the user instead of filling 0 when the response has no amount', async () => {
        mockCalculateSwapAmount.mockResolvedValueOnce({})

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handleMaxPress()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockInfoToast).toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('clears the amounts and the asset pair when the selected account changes', async () => {
        mockCalculateSwapAmount.mockResolvedValueOnce({
            amount: new Decimal('5000000'),
        })
        const { result, rerender } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handleMaxPress()
        })
        expect(result.current.payAmount).not.toBeNull()

        mockSelectedAccount = { address: 'OTHERADDRESS456' }
        rerender()

        expect(result.current.payAmount).toBeNull()
        expect(result.current.receiveAmount).toBeNull()
        expect(mockResetAssetPair).toHaveBeenCalledTimes(1)
    })

    it('clears the form when the screen loses focus', async () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })
        expect(result.current.payAmount).toEqual(new Decimal(5))

        act(() => {
            focusEffectCleanup?.()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockResetAssetPair).toHaveBeenCalled()
    })

    it('tells the user why MAX produced nothing when the account holds no pay asset', async () => {
        mockPayBalance = null
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handleMaxPress()
        })

        expect(mockCalculateSwapAmount).not.toHaveBeenCalled()
        expect(mockInfoToast).toHaveBeenCalled()
    })

    it('surfaces an error toast when the percentage calculation fails', async () => {
        mockCalculateSwapAmount.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handleMaxPress()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('handleOpenConfig applies slippage when the config sheet returns a result', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: '1.5',
            balancePercentage: null,
            useLocalCurrency: false,
        })
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetSlippage).toHaveBeenCalledWith('1.5')
    })

    it('handleOpenConfig clears slippage when slippageTolerance is null', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: null,
            balancePercentage: null,
            useLocalCurrency: false,
        })
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetSlippage).toHaveBeenCalledWith(null)
    })

    it('handleOpenConfig enables the swap-scoped local currency input when the toggle is on', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: null,
            balancePercentage: null,
            useLocalCurrency: true,
        })
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetIsLocalCurrencyInput).toHaveBeenCalledWith(true)
    })

    it('handleOpenConfig disables the swap-scoped local currency input when the toggle is off', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: null,
            balancePercentage: null,
            useLocalCurrency: false,
        })
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetIsLocalCurrencyInput).toHaveBeenCalledWith(false)
    })

    it('handleOpenConfig no-ops when the config sheet is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetSlippage).not.toHaveBeenCalled()
        expect(mockSetIsLocalCurrencyInput).not.toHaveBeenCalled()
    })

    it('converts stored slippage percent to decimal fraction', async () => {
        mockSlippage = '1'
        mockCreateQuotes.mockResolvedValueOnce([])

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(2))
        })

        expect(mockCreateQuotes).toHaveBeenCalledWith(
            expect.objectContaining({ slippage: '0.01' }),
        )
    })

    it('omits slippage when none is set', async () => {
        mockSlippage = null
        mockCreateQuotes.mockResolvedValueOnce([])

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(2))
        })

        expect(mockCreateQuotes).toHaveBeenCalledWith(
            expect.objectContaining({ slippage: undefined }),
        )
    })

    it('handleOpenConfirm is a no-op when there is no selected quote', async () => {
        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            await result.current.handleOpenConfirm()
        })

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    describe('insufficient balance', () => {
        it('flags an amount larger than the holding and blocks the swap', () => {
            mockPayBalance = new Decimal(50)
            const { result } = renderHook(() => useSwapForm())

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1000))
            })

            expect(result.current.hasInsufficientBalance).toBe(true)
            expect(result.current.canSwap).toBe(false)
        })

        it('allows an amount within the holding', () => {
            mockPayBalance = new Decimal(50)
            const { result } = renderHook(() => useSwapForm())

            act(() => {
                result.current.handlePayAmountChange(new Decimal(50))
            })

            expect(result.current.hasInsufficientBalance).toBe(false)
        })

        // The reported case: swapping an asset the account does not hold at all,
        // where the balance query settles with no holding row.
        it('treats a settled query with no holding as a zero balance', () => {
            mockPayBalance = null
            const { result } = renderHook(() => useSwapForm())

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1))
            })

            expect(result.current.hasInsufficientBalance).toBe(true)
        })

        it('stays quiet until the balance query has settled', () => {
            mockPayBalance = null
            mockIsPayBalanceFetched = false
            const { result } = renderHook(() => useSwapForm())

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1))
            })

            expect(result.current.hasInsufficientBalance).toBe(false)
        })

        // `isFetched` is true after a failed fetch too, so without an explicit
        // error check a dropped balance request reads as a zero holding and
        // blocks the swap behind copy blaming the user's balance.
        it('stays quiet when the balance query settled with an error', () => {
            mockPayBalance = null
            mockIsPayBalanceFetched = true
            mockIsPayBalanceError = true
            const { result } = renderHook(() => useSwapForm())

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1))
            })

            expect(result.current.hasInsufficientBalance).toBe(false)
        })
    })
})
