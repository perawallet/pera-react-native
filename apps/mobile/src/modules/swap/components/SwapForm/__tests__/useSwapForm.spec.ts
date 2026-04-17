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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useSwapForm } from '../useSwapForm'

const mockSetFromAsset = vi.fn()
const mockSetToAsset = vi.fn()
const mockSetSlippage = vi.fn()
const mockResetQuoteMutation = vi.fn()
const mockCreateQuotes = vi.fn()
const mockCalculateSwapAmount = vi.fn()
const mockSwapExecute = vi.fn().mockResolvedValue(true)
const mockSwapReset = vi.fn()
const mockSetPreferredCurrency = vi.fn()

let mockFromAsset = '0'
let mockToAsset = '31566704'
let mockSlippage: string | null = null
let mockPreferredCurrency = 'ALGO'

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({
        fromAsset: mockFromAsset,
        toAsset: mockToAsset,
        slippage: mockSlippage,
        setFromAsset: mockSetFromAsset,
        setToAsset: mockSetToAsset,
        setSlippage: mockSetSlippage,
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

const mockSelectedAccount = { address: 'TESTADDRESS123' }
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => mockSelectedAccount,
    useAccountAssetBalanceQuery: () => ({
        data: { amount: new Decimal('5000000') },
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
        ]),
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    baseUnitsToDisplayUnits: (amount: Decimal, decimals: number) =>
        amount.div(Decimal.pow(10, decimals)),
    displayUnitsToBaseUnits: (amount: Decimal, decimals: number) =>
        amount.mul(Decimal.pow(10, decimals)),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'test-device-id',
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: mockPreferredCurrency,
        setPreferredCurrency: mockSetPreferredCurrency,
        fallbackCurrency: 'USD',
    }),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: () => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
    }),
}))

vi.mock('@hooks/useDebouncedValue', () => ({
    useDebouncedValue: (value: unknown) => value,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    isDecimalEqual: (a: Decimal | null, b: Decimal | null) => {
        if (a === b) return true
        if (a === null || b === null) return false
        return a.equals(b)
    },
}))

vi.mock('../../../hooks/useSwapExecution', () => ({
    useSwapExecution: () => ({
        execute: mockSwapExecute,
        status: 'idle' as const,
        error: null,
        txIds: [],
        reset: mockSwapReset,
    }),
}))

describe('useSwapForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFromAsset = '0'
        mockToAsset = '31566704'
        mockSlippage = null
        mockPreferredCurrency = 'ALGO'
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

    it('handlePayAssetSelected preserves pay amount and clears receive amount and quote', () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        act(() => {
            result.current.handlePayAssetSelected({
                assetId: '123',
                amount: new Decimal(1000),
            } as AssetWithAccountBalance)
        })

        expect(mockSetFromAsset).toHaveBeenCalledWith('123')
        expect(result.current.payAmount).toEqual(new Decimal(5))
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(mockResetQuoteMutation).toHaveBeenCalled()
    })

    it('handlePayAssetSelected triggers quote re-fetch when pay amount exists', async () => {
        mockCreateQuotes.mockResolvedValue([])

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)

        mockFromAsset = '123'
        await act(async () => {
            result.current.handlePayAssetSelected({
                assetId: '123',
                amount: new Decimal(1000),
            } as AssetWithAccountBalance)
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(2)
    })

    it('handleReceiveAssetSelected triggers quote re-fetch when pay amount exists', async () => {
        mockCreateQuotes.mockResolvedValue([])

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)

        mockToAsset = '456'
        await act(async () => {
            result.current.handleReceiveAssetSelected({
                assetId: '456',
                amount: new Decimal(0),
            } as AssetWithAccountBalance)
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(2)
    })

    it('handlePayAssetSelected marks isQuoteFetching true immediately after asset change', async () => {
        mockCreateQuotes.mockResolvedValue([])

        const { result } = renderHook(() => useSwapForm())

        // Establish a quoted state
        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        // Synchronously change the from asset — quotedAmount should reset
        act(() => {
            result.current.handlePayAssetSelected({
                assetId: '123',
                amount: new Decimal(1000),
            } as AssetWithAccountBalance)
        })

        expect(result.current.isQuoteFetching).toBe(true)
    })

    it('handleReceiveAssetSelected marks isQuoteFetching true immediately after asset change', async () => {
        mockCreateQuotes.mockResolvedValue([])

        const { result } = renderHook(() => useSwapForm())

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        act(() => {
            result.current.handleReceiveAssetSelected({
                assetId: '456',
                amount: new Decimal(0),
            } as AssetWithAccountBalance)
        })

        expect(result.current.isQuoteFetching).toBe(true)
    })

    it('handleReceiveAssetSelected clears receive amount and quote', () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handleReceiveAssetSelected({
                assetId: '456',
                amount: new Decimal(0),
            } as AssetWithAccountBalance)
        })

        expect(mockSetToAsset).toHaveBeenCalledWith('456')
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(mockResetQuoteMutation).toHaveBeenCalled()
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

    it('handleConfigApply applies slippage', () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handleConfigApply({
                slippageTolerance: '1.5',
                balancePercentage: null,
                useLocalCurrency: false,
            })
        })

        expect(mockSetSlippage).toHaveBeenCalledWith('1.5')
    })

    it('handleConfigApply clears slippage when slippageTolerance is null', () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handleConfigApply({
                slippageTolerance: null,
                balancePercentage: null,
                useLocalCurrency: false,
            })
        })

        expect(mockSetSlippage).toHaveBeenCalledWith(null)
    })

    it('handleConfigApply switches to local currency when useLocalCurrency is true and ALGO preferred', () => {
        mockPreferredCurrency = 'ALGO'
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handleConfigApply({
                slippageTolerance: null,
                balancePercentage: null,
                useLocalCurrency: true,
            })
        })

        expect(mockSetPreferredCurrency).toHaveBeenCalledWith('USD')
    })

    it('handleConfigApply switches to ALGO when useLocalCurrency is false and fiat preferred', () => {
        mockPreferredCurrency = 'USD'
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handleConfigApply({
                slippageTolerance: null,
                balancePercentage: null,
                useLocalCurrency: false,
            })
        })

        expect(mockSetPreferredCurrency).toHaveBeenCalledWith('ALGO')
    })

    it('converts stored slippage percent to decimal fraction when fetching quotes', async () => {
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

    it('handleOpenConfirm resets swap execution state before opening the confirm modal', () => {
        const { result } = renderHook(() => useSwapForm())

        act(() => {
            result.current.handleOpenConfirm()
        })

        expect(mockSwapReset).toHaveBeenCalled()
        expect(result.current.confirmModal.open).toHaveBeenCalled()
    })
})
