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

import { renderHook, act } from '@testing-library/react-native'
import { useInputView } from '../use-input-view'
import { SendFundsContext } from '@modules/transactions/providers/SendFundsProvider'
import Decimal from 'decimal.js'
import React from 'react'

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
import useToast from '@hooks/toast'

jest.mock('@components/bottom-sheet/PWBottomSheet', () => ({
    bottomSheetNotifier: { current: null },
}))

jest.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: jest.fn(),
    useAccountBalancesQuery: jest.fn(),
}))

jest.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: jest.fn(),
    useAssetFiatPricesQuery: jest.fn(),
    ALGO_ASSET_ID: 0,
    ALGO_ASSET: { id: 0, decimals: 6 },
    toWholeUnits: jest.fn(() => 0.001),
}))

jest.mock('@perawallet/wallet-core-blockchain', () => ({
    useSuggestedParametersQuery: jest.fn(),
    useAccountInformationQuery: jest.fn(),
}))

jest.mock('@hooks/toast', () => ({
    __esModule: true,
    default: jest.fn(() => ({ showToast: jest.fn() })),
}))

jest.mock('@hooks/language', () => ({
    useLanguage: jest.fn(() => ({ t: (key: string) => key })),
}))

describe('useInputView', () => {
    const mockOnNext = jest.fn()
    const mockSetAmount = jest.fn()
    const mockSetNote = jest.fn()
    const mockShowToast = jest.fn()

    const defaultContext = {
        selectedAsset: { assetId: 0 },
        note: null,
        setNote: mockSetNote,
        setAmount: mockSetAmount,
    }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useToast as jest.Mock).mockReturnValue({ showToast: mockShowToast })
        ;(useSelectedAccount as jest.Mock).mockReturnValue({
            address: 'test-addr',
        })
        ;(useAssetsQuery as jest.Mock).mockReturnValue({
            data: new Map([
                [0, { id: 0, decimals: 6 }],
                [1, { id: 1, decimals: 0 }],
            ]),
        })
        ;(useAssetFiatPricesQuery as jest.Mock).mockReturnValue({
            data: new Map([[0, { fiatPrice: Decimal(1.5) }]]),
        })
        ;(useAccountBalancesQuery as jest.Mock).mockReturnValue({
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
        ;(useSuggestedParametersQuery as jest.Mock).mockReturnValue({
            data: { minFee: 1000 },
        })
        ;(useAccountInformationQuery as jest.Mock).mockReturnValue({
            data: {
                amount: 100,
                minBalance: 0.1,
            },
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <SendFundsContext.Provider value={defaultContext as any}>
            {children}
        </SendFundsContext.Provider>
    )

    it('calculates max amount for Algo correctly', () => {
        const { result } = renderHook(() => useInputView(mockOnNext), {
            wrapper,
        })
        expect(result.current.maxAmount.toNumber()).toBe(99.9)
    })

    it('calculates max amount for ASA correctly', () => {
        const asaContext = { ...defaultContext, selectedAsset: { assetId: 1 } }
        const { result } = renderHook(() => useInputView(mockOnNext), {
            wrapper: ({ children }) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <SendFundsContext.Provider value={asaContext as any}>
                    {children}
                </SendFundsContext.Provider>
            ),
        })
        expect(result.current.maxAmount.toNumber()).toBe(50)
    })

    it('handles keypad input correctly', () => {
        const { result } = renderHook(() => useInputView(mockOnNext), {
            wrapper,
        })

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
        const { result } = renderHook(() => useInputView(mockOnNext), {
            wrapper,
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

    it('validates input on next (error if > max)', () => {
        ;(useAccountInformationQuery as jest.Mock).mockReturnValue({
            data: { amount: 10, minBalance: 0 },
        })

        const { result } = renderHook(() => useInputView(mockOnNext), {
            wrapper,
        })
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
        ;(useAccountInformationQuery as jest.Mock).mockReturnValue({
            data: { amount: 100, minBalance: 0 },
        })

        const { result } = renderHook(() => useInputView(mockOnNext), {
            wrapper,
        })
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
        const { result } = renderHook(() => useInputView(mockOnNext), {
            wrapper,
        })
        act(() => {
            result.current.setMax()
        })
        expect(result.current.cryptoValue).toBe('99.9')
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.9')
    })
})
