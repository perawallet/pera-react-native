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
import { useInputView } from '../useInputView'
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

vi.mock('@components/core/PWBottomSheet', () => ({
    bottomSheetNotifier: { current: null },
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
    toWholeUnits: vi.fn(() => 0.001),
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

describe('useInputView', () => {
    const mockOnNext = vi.fn()
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
                amount: 100,
                minBalance: 0.1,
            },
        })
    })

    it('calculates max amount for Algo correctly', () => {
        const { result } = renderHook(() => useInputView(mockOnNext))
        expect(result.current.maxAmount.toNumber()).toBe(99.9)
    })

    it('calculates max amount for ASA correctly', () => {
        // Update mock state for ASA
        mockSendFundsState.selectedAsset = { assetId: 1 }

        const { result } = renderHook(() => useInputView(mockOnNext))
        expect(result.current.maxAmount.toNumber()).toBe(50)
    })

    it('handles keypad input correctly', () => {
        const { result } = renderHook(() => useInputView(mockOnNext))

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
        const { result } = renderHook(() => useInputView(mockOnNext))
        act(() => {
            result.current.handleNext()
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockOnNext).not.toHaveBeenCalled()
    })

    it('validates input on next (error if > max)', () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 10, minBalance: 0 },
        })

        const { result } = renderHook(() => useInputView(mockOnNext))
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
        expect(mockOnNext).not.toHaveBeenCalled()
    })

    it('proceeds on next if valid', () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 100, minBalance: 0 },
        })

        const { result } = renderHook(() => useInputView(mockOnNext))
        act(() => {
            result.current.setCryptoValue('5')
        })
        act(() => {
            result.current.handleNext()
        })
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('5')
        expect(mockOnNext).toHaveBeenCalled()
    })

    it('setMax updates value to max', () => {
        const { result } = renderHook(() => useInputView(mockOnNext))
        act(() => {
            result.current.setMax()
        })
        expect(result.current.cryptoValue).toBe('99.9')
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.9')
    })
})
