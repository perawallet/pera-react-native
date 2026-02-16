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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInputScreen } from '../useInputScreen'
import Decimal from 'decimal.js'

import {
    useSelectedAccount,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    useAssetFiatPricesQuery,
} from '@perawallet/wallet-core-assets'
import {
    useSuggestedParametersQuery,
    useAccountInformationQuery,
} from '@perawallet/wallet-core-blockchain'
import { useToast } from '@hooks/useToast'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
    PWButton: vi.fn(),
    PWText: vi.fn(),
    PWView: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountBalancesQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
    useAssetFiatPricesQuery: vi.fn(),
    ALGO_ASSET_ID: 0,
    ALGO_ASSET: { id: 0, decimals: 6 },
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        Decimal(typeof value === 'bigint' ? value.toString() : value).div(
            Decimal(10).pow(asset.decimals),
        ),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useSuggestedParametersQuery: vi.fn(),
    useAccountInformationQuery: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({ showToast: vi.fn() })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(() => ({ t: (key: string) => key })),
}))

// Mock the useSendFunds hook
const mockSetAmount = vi.fn()
const mockSetNote = vi.fn()
const mockSendFundsState = {
    selectedAsset: { assetId: 0 },
    canSelectAsset: true,
    amount: undefined,
    note: undefined,
    destination: undefined,
    setSelectedAsset: vi.fn(),
    setCanSelectAsset: vi.fn(),
    setAmount: mockSetAmount,
    setNote: mockSetNote,
    setDestination: vi.fn(),
    reset: vi.fn(),
}

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(() => mockSendFundsState),
}))

describe('useInputScreen', () => {
    const mockShowToast = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // Reset the mock state
        mockSendFundsState.selectedAsset = { assetId: 0 }
        mockSendFundsState.note = undefined
        ;(useToast as Mock).mockReturnValue({ showToast: mockShowToast })
        ;(useSelectedAccount as Mock).mockReturnValue({
            address: 'test-addr',
        })
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([
                [0, { id: 0, decimals: 6 }],
                [1, { id: 1, decimals: 0 }],
            ]),
        })
        ;(useAssetFiatPricesQuery as Mock).mockReturnValue({
            data: new Map([[0, { fiatPrice: Decimal(1.5) }]]),
        })
        ;(useAccountBalancesQuery as Mock).mockReturnValue({
            accountBalances: new Map([
                [
                    'test-addr',
                    {
                        assetBalances: [
                            { assetId: 0, amount: Decimal(100) },
                            { assetId: 1, amount: Decimal(50) },
                        ],
                    },
                ],
            ]),
        })
        ;(useSuggestedParametersQuery as Mock).mockReturnValue({
            data: { minFee: 1000 },
        })
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 100_000n,
            },
        })
    })

    it('calculates max amount for Algo correctly', () => {
        const { result } = renderHook(() => useInputScreen())
        expect(result.current.maxAmount.toNumber()).toBe(99.899)
    })

    it('calculates total balance for Algo correctly', () => {
        const { result } = renderHook(() => useInputScreen())
        // totalBalance = balance
        expect(result.current.totalBalance.toNumber()).toBe(100)
    })

    it('calculates minBalanceDisplay for Algo correctly', () => {
        const { result } = renderHook(() => useInputScreen())
        // minBalance = 100_000 microAlgo = 0.1 ALGO
        expect(result.current.minBalanceDisplay).toBe('0.1')
    })

    it('calculates max amount for ASA correctly', () => {
        // Update mock state for ASA
        mockSendFundsState.selectedAsset = { assetId: 1 }

        const { result } = renderHook(() => useInputScreen())
        expect(result.current.maxAmount.toNumber()).toBe(50)
    })

    it('handles keypad input correctly', () => {
        const { result } = renderHook(() => useInputScreen())

        act(() => {
            result.current.handleKey('1')
        })
        expect(result.current.cryptoValue).toBe('1')

        act(() => {
            result.current.handleKey('2')
        })
        expect(result.current.cryptoValue).toBe('12')

        act(() => {
            result.current.handleKey()
        })
        expect(result.current.cryptoValue).toBe('1')

        act(() => {
            result.current.handleKey()
        })
        expect(result.current.cryptoValue).toBeNull()
    })

    it('validates input on next (error if 0/empty)', () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.handleNext()
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows toast when value exceeds total balance', () => {
        // amount=10 ALGO, minBalance=0 → totalBalance = 10 - 0.001 = 9.999
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 10_000_000n, minBalance: 0n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('20')
        })
        act(() => {
            result.current.handleNext()
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(result.current.isMaxExceeded).toBe(false)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows min balance panel when value exceeds MBR but within total balance', () => {
        // amount=100 ALGO, minBalance=1 ALGO, fee=0.001
        // maxAmount = 100 - 1 - 0.001 = 98.999
        // totalBalance = 100 - 0.001 = 99.999
        // value=99.5 → > maxAmount but < totalBalance → show panel
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 100_000_000n, minBalance: 1_000_000n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.5')
        })
        act(() => {
            result.current.handleNext()
        })
        expect(result.current.isMaxExceeded).toBe(true)
        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('proceeds on next if valid', () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 100_000_000n, minBalance: 0n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('5')
        })
        act(() => {
            result.current.handleNext()
        })
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('5')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('handleContinuePastMbr sets amount to max and navigates', () => {
        // maxAmount = 100 - 0.1 - 0.001 = 99.899
        const { result } = renderHook(() => useInputScreen())

        // First trigger the panel
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        act(() => {
            result.current.handleNext()
        })
        expect(result.current.isMaxExceeded).toBe(true)

        // Then continue past MBR
        act(() => {
            result.current.handleContinuePastMbr()
        })
        expect(result.current.isMaxExceeded).toBe(false)
        expect(mockSetAmount).toHaveBeenCalledWith(
            expect.objectContaining({
                toString: expect.any(Function),
            }),
        )
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.899')
        expect(result.current.cryptoValue).toBe('99.899')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('setMax sets value to full account balance', () => {
        // account balance = 100 ALGO (100_000_000 microAlgo)
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setMax()
        })
        expect(result.current.cryptoValue).toBe('100')
        expect(mockSetAmount).not.toHaveBeenCalled()
    })

    it('treats leading decimal point as 0.', () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.handleKey('.')
        })
        expect(result.current.cryptoValue).toBe('0.')
        act(() => {
            result.current.handleKey('5')
        })
        expect(result.current.cryptoValue).toBe('0.5')
    })

    it('ignores second decimal point in keypad input', () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.handleKey('1')
        })
        act(() => {
            result.current.handleKey('.')
        })
        act(() => {
            result.current.handleKey('.')
        })
        act(() => {
            result.current.handleKey('5')
        })
        expect(result.current.cryptoValue).toBe('1.5')
    })

    it('shows toast when value exceeds zero balance', () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 0n, minBalance: 0n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('0.1')
        })
        act(() => {
            result.current.handleNext()
        })
        // totalBalance = 0 - 0.001 = 0 (clamped), so 0.1 > 0 → toast
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('dismisses max exceeded state', () => {
        // Set up scenario where panel shows (value > maxAmount but <= totalBalance)
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 100_000_000n, minBalance: 1_000_000n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.5')
        })
        act(() => {
            result.current.handleNext()
        })
        expect(result.current.isMaxExceeded).toBe(true)
        act(() => {
            result.current.dismissMaxExceeded()
        })
        expect(result.current.isMaxExceeded).toBe(false)
    })
})
