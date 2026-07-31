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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInputScreen } from '../useInputScreen'
import { Decimal } from 'decimal.js'

import {
    useSelectedAccount,
    useAccountBalancesQuery,
    useAccountInformationQuery,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    useAssetPricesQuery,
} from '@perawallet/wallet-core-assets'
import { useSuggestedParametersQuery } from '@perawallet/wallet-core-blockchain'
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

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountBalancesQuery: vi.fn(),
    useAccountInformationQuery: vi.fn(),
    useAccountAssetBalanceQuery: vi.fn(() => ({
        data: {
            assetId: '0',
            amount: new Decimal(100),
            algoValue: new Decimal(100),
        },
    })),
    isRekeyedAccount: vi.fn(() => false),
    // Consumed by the shared useSendDestinationRouter that useInputScreen now
    // calls for the deeplink-prefill direct-navigation path.
    useAllAccounts: vi.fn(() => []),
    useOnChainAccountInformationQuery: vi.fn(() => ({
        data: undefined,
        isFetching: false,
        isSuccess: false,
        isError: false,
    })),
    canSignWith: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
    useAssetPricesQuery: vi.fn(),
    ALGO_ASSET: { id: '0', decimals: 6 },
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        new Decimal(typeof value === 'bigint' ? value.toString() : value).div(
            new Decimal(10).pow(asset.decimals),
        ),
    isCollectible: () => false,
    isPureNft: () => false,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useSuggestedParametersQuery: vi.fn(),
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
const mockSetIsCloseAccount = vi.fn()
const mockSendFundsState = {
    selectedAssetId: '0',
    canSelectAsset: true,
    amount: undefined,
    note: undefined,
    destination: undefined as string | undefined,
    setSelectedAssetId: vi.fn(),
    setCanSelectAsset: vi.fn(),
    setAmount: mockSetAmount,
    setNote: mockSetNote,
    setDestination: vi.fn(),
    setSendMode: vi.fn(),
    setIsCloseAccount: mockSetIsCloseAccount,
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
        mockSendFundsState.selectedAssetId = '0'
        mockSendFundsState.note = undefined
        mockSendFundsState.destination = undefined
        ;(useToast as Mock).mockReturnValue({ showToast: mockShowToast })
        ;(useSelectedAccount as Mock).mockReturnValue({
            address: 'test-addr',
        })
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([
                ['0', { id: '0', decimals: 6 }],
                ['1', { id: '1', decimals: 0 }],
            ]),
        })
        ;(useAssetPricesQuery as Mock).mockReturnValue({
            data: new Map([['0', { usdPrice: new Decimal(1.5) }]]),
        })
        ;(useAccountBalancesQuery as Mock).mockReturnValue({
            accountBalances: new Map([
                [
                    'test-addr',
                    {
                        assetBalances: [
                            { assetId: '0', amount: new Decimal(100) },
                            { assetId: '1', amount: new Decimal(50) },
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
                assets: [{ assetId: 123, amount: 0n, isFrozen: false }],
            },
        })
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it('calculates max amount for Algo correctly', () => {
        const { result } = renderHook(() => useInputScreen())
        expect(result.current.maxAmount.toNumber()).toBe(99.899)
    })

    it('calculates total balance for Algo correctly', () => {
        const { result } = renderHook(() => useInputScreen())
        expect(result.current.totalBalance.toNumber()).toBe(100)
    })

    it('calculates minBalanceDisplay for Algo correctly', () => {
        const { result } = renderHook(() => useInputScreen())
        expect(result.current.minBalanceDisplay).toBe('0.1')
    })

    it('calculates max amount for ASA correctly', () => {
        mockSendFundsState.selectedAssetId = '1'

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

    it('validates input on next (error if 0/empty)', async () => {
        const { result } = renderHook(() => useInputScreen())
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows toast when value exceeds total balance', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 10_000_000n, minBalance: 0n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('20')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('opens insufficient-balance confirm when value exceeds MBR but within total balance', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 1_000_000n,
                assets: [{ assetId: 123, amount: 0n, isFrozen: false }],
            },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.5')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('continues past MBR when insufficient-balance confirm resolves true', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 1_000_000n,
                assets: [{ assetId: 123, amount: 0n, isFrozen: false }],
            },
        })
        mockRequestBottomSheet.mockResolvedValue(true)

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.5')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        // maxAmount = 100 - 1 - 0.001 = 98.999
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('98.999')
        expect(result.current.cryptoValue).toBe('98.999')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('does not navigate when insufficient-balance confirm is dismissed', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 1_000_000n,
                assets: [{ assetId: 123, amount: 0n, isFrozen: false }],
            },
        })
        mockRequestBottomSheet.mockResolvedValue(undefined)

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.5')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockSetAmount).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('proceeds on next if valid', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 100_000_000n, minBalance: 0n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('5')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('5')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('skips the picker and routes straight through when a deeplink prefilled the destination', async () => {
        // Value-bearing deeplink: ALGO receiver already known, so tapping Next
        // must jump straight to Confirm instead of pushing SelectDestination.
        mockSendFundsState.destination = 'RECEIVERADDR'
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 100_000_000n, minBalance: 0n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('5')
        })
        await act(async () => {
            await result.current.handleNext()
        })

        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
        expect(mockNavigate).not.toHaveBeenCalledWith('SelectDestination')
    })

    it('setMax sets value to full account balance', () => {
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

    it('shows toast when value exceeds zero balance', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: { amount: 0n, minBalance: 0n },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('0.1')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('opens close-account confirm when ALGO exceeds MBR and no opted-in ASAs', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 100_000n,
                assets: [],
            },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('confirms close account when confirm resolves true', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 100_000n,
                assets: [],
            },
        })
        mockRequestBottomSheet.mockResolvedValue(true)

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockSetIsCloseAccount).toHaveBeenCalledWith(true)
        // amount = totalBalance - fee = 100 - 0.001 = 99.999
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.999')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('does not confirm close account when confirm is dismissed', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 100_000n,
                assets: [],
            },
        })
        mockRequestBottomSheet.mockResolvedValue(undefined)

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockSetIsCloseAccount).not.toHaveBeenCalledWith(true)
        expect(mockSetAmount).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('resets isCloseAccount when amount is within maxAmount on next', async () => {
        ;(useAccountInformationQuery as Mock).mockReturnValue({
            data: {
                amount: 100_000_000n,
                minBalance: 100_000n,
                assets: [],
            },
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('5')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockSetIsCloseAccount).toHaveBeenCalledWith(false)
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })
})
