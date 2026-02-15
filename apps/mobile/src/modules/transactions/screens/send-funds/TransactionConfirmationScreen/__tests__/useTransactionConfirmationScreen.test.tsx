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
import { useTransactionConfirmationScreen } from '../useTransactionConfirmationScreen'
import Decimal from 'decimal.js'
import {
    useSelectedAccount,
    useAccountAssetBalanceQuery,
    useTransactionSigner,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    useAssetFiatPricesQuery,
} from '@perawallet/wallet-core-assets'
import {
    useSuggestedParametersQuery,
    useAlgorandClient,
} from '@perawallet/wallet-core-blockchain'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
    PWButton: vi.fn(),
    PWText: vi.fn(),
    PWView: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountAssetBalanceQuery: vi.fn(),
    useTransactionSigner: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
    useAssetFiatPricesQuery: vi.fn(),
    ALGO_ASSET_ID: '0',
    ALGO_ASSET: { id: '0', decimals: 6 },
    toDecimalUnits: (value: number | Decimal) => {
        if (value instanceof Decimal) {
            return value
        }
        return new Decimal(value)
    },
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        Decimal(typeof value === 'bigint' ? value.toString() : value).div(
            Decimal(10).pow(asset.decimals),
        ),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useSuggestedParametersQuery: vi.fn(),
    useAlgorandClient: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    DEFAULT_PRECISION: 2,
    formatCurrency: vi.fn(() => '10.00'),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

// Mock BigInt to return an object with microAlgo method for AlgoKit compatibility
const originalBigInt = global.BigInt
const mockBigIntFn = vi.fn((value: string | number | bigint) => {
    const bigIntValue = originalBigInt(value)
    return {
        microAlgo: () => bigIntValue,
        valueOf: () => bigIntValue,
        toString: () => bigIntValue.toString(),
    }
})
vi.stubGlobal('BigInt', mockBigIntFn)

describe('useTransactionConfirmationScreen', () => {
    const mockOnNext = vi.fn()
    const mockShowToast = vi.fn()
    const mockSignTransactions = vi.fn()
    const mockPayment = vi.fn()
    const mockAssetTransfer = vi.fn()

    const mockAccount = {
        address: 'TEST_ADDRESS',
        name: 'Test Account',
    }

    const mockSelectedAsset = {
        assetId: '123',
    }

    const mockAlgoAsset = {
        assetId: '0',
    }

    const mockAsset = {
        id: '123',
        decimals: 6,
        name: 'Test Asset',
        unitName: 'TEST',
    }

    const mockAlgoAssetData = {
        id: '0',
        decimals: 6,
        name: 'Algorand',
        unitName: 'ALGO',
    }

    const mockSendFundsState = {
        selectedAsset: undefined,
        canSelectAsset: true,
        amount: undefined,
        note: undefined,
        destination: undefined,
        onFinished: mockOnNext,
        setSelectedAsset: vi.fn(),
        setCanSelectAsset: vi.fn(),
        setAmount: vi.fn(),
        setNote: vi.fn(),
        setDestination: vi.fn(),
        setOnFinished: vi.fn(),
        reset: vi.fn(),
    }

    const mockAlgokit = {
        send: {
            payment: mockPayment,
            assetTransfer: mockAssetTransfer,
        },
    }

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useToast as Mock).mockReturnValue({
            showToast: mockShowToast,
        })
        ;(useSelectedAccount as Mock).mockReturnValue(null)
        ;(useTransactionSigner as Mock).mockReturnValue({
            signTransactions: mockSignTransactions,
        })
        ;(useAlgorandClient as Mock).mockReturnValue(mockAlgokit)
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map(),
        })
        ;(useAssetFiatPricesQuery as Mock).mockReturnValue({
            data: new Map(),
        })
        ;(useCurrency as Mock).mockReturnValue({
            preferredFiatCurrency: 'USD',
        })
        ;(useSuggestedParametersQuery as Mock).mockReturnValue({
            data: { minFee: 1000 },
            isPending: false,
        })
        ;(useAccountAssetBalanceQuery as Mock).mockReturnValue({
            data: {
                amount: new Decimal(100),
                fiatValue: new Decimal(200),
            },
            isPending: false,
        })
        ;(useSendFunds as Mock).mockReturnValue(mockSendFundsState)
    })

    describe('isReady state', () => {
        it('should return isReady as false when selectedAccount is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(null)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as false when selectedAsset is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: undefined,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as false when amount is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: undefined,
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as false when asset is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map(),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as true when all required data is present', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(true)
        })
    })

    describe('handleConfirm', () => {
        it('should show error toast when required data is missing', async () => {
            ;(useSelectedAccount as Mock).mockReturnValue(null)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: undefined,
                amount: undefined,
                destination: undefined,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(mockShowToast).toHaveBeenCalledWith(
                {
                    title: 'Invalid transaction',
                    body: 'Something appears to have gone wrong with this transaction.',
                    type: 'error',
                },
                { notifier: undefined },
            )
            expect(mockOnNext).not.toHaveBeenCalled()
        })

        it('should send ALGO payment when selectedAsset is ALGO', async () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockAlgoAsset,
                amount: new Decimal(5),
                destination: 'DEST_ADDRESS',
                note: 'Test note',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['0', mockAlgoAssetData]]),
            })

            mockPayment.mockResolvedValue({ txId: 'PAYMENT_TX_ID' })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(mockPayment).toHaveBeenCalledWith({
                sender: 'TEST_ADDRESS',
                receiver: 'DEST_ADDRESS',
                amount: expect.any(BigInt),
                note: 'Test note',
            })
            expect(mockAssetTransfer).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                {
                    title: 'Transfer Successful',
                    body: 'You successfully sent 10.00 ALGO.',
                    type: 'success',
                },
                { notifier: undefined },
            )
            expect(mockOnNext).toHaveBeenCalled()
        })

        it('should send ASA transfer when selectedAsset is not ALGO', async () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
                note: 'ASA note',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            mockAssetTransfer.mockResolvedValue({ txId: 'ASSET_TX_ID' })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(mockAssetTransfer).toHaveBeenCalledWith({
                sender: 'TEST_ADDRESS',
                receiver: 'DEST_ADDRESS',
                amount: expect.objectContaining({
                    microAlgo: expect.any(Function),
                }),
                assetId: expect.objectContaining({
                    microAlgo: expect.any(Function),
                }),
                note: 'ASA note',
            })
            expect(mockPayment).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                {
                    title: 'Transfer Successful',
                    body: 'You successfully sent 10.00 TEST.',
                    type: 'success',
                },
                { notifier: undefined },
            )
            expect(mockOnNext).toHaveBeenCalled()
        })

        it('should call onNext on successful transaction', async () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockAlgoAsset,
                amount: new Decimal(5),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['0', mockAlgoAssetData]]),
            })

            mockPayment.mockResolvedValue({ txId: 'SUCCESS_TX_ID' })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(mockOnNext).toHaveBeenCalledTimes(1)
        })

        it('should show error toast on transaction failure', async () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockAlgoAsset,
                amount: new Decimal(5),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['0', mockAlgoAssetData]]),
            })

            const mockError = new Error('Network error')
            mockPayment.mockRejectedValue(mockError)

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(mockShowToast).toHaveBeenCalledWith(
                {
                    title: 'Error sending transaction',
                    body: `${mockError}`,
                    type: 'error',
                },
                { notifier: undefined },
            )
            expect(mockOnNext).not.toHaveBeenCalled()
        })
    })

    describe('note state', () => {
        it('should toggle noteOpen state with openNote and closeNote', () => {
            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.noteOpen).toBe(false)

            act(() => {
                result.current.openNote()
            })

            expect(result.current.noteOpen).toBe(true)

            act(() => {
                result.current.closeNote()
            })

            expect(result.current.noteOpen).toBe(false)
        })
    })

    describe('fiatPrice calculation', () => {
        it('should calculate fiatPrice correctly when price data exists', () => {
            const mockAmount = new Decimal(10)
            const mockPrice = new Decimal(5)

            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: mockAmount,
            })
            ;(useAssetFiatPricesQuery as Mock).mockReturnValue({
                data: new Map([['123', { fiatPrice: mockPrice }]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.fiatPrice).toEqual(mockAmount.mul(mockPrice))
        })

        it('should return null for fiatPrice when no price data exists', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: new Decimal(10),
            })
            ;(useAssetFiatPricesQuery as Mock).mockReturnValue({
                data: new Map(),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.fiatPrice).toBeNull()
        })

        it('should return null for fiatPrice when amount is undefined', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: undefined,
            })
            ;(useAssetFiatPricesQuery as Mock).mockReturnValue({
                data: new Map([[123, { fiatPrice: new Decimal(5) }]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.fiatPrice).toBeNull()
        })

        it('should return null for fiatPrice when selectedAsset is undefined', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: undefined,
                amount: new Decimal(10),
            })
            ;(useAssetFiatPricesQuery as Mock).mockReturnValue({
                data: new Map([[123, { fiatPrice: new Decimal(5) }]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.fiatPrice).toBeNull()
        })
    })

    describe('asset resolution', () => {
        it('should resolve asset from assets map', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.asset).toEqual(mockAsset)
        })

        it('should return null for asset when selectedAsset has no assetId', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: { assetId: undefined },
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.asset).toBeNull()
        })

        it('should return undefined for asset when not in assets map', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map(),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.asset).toBeUndefined()
        })
    })

    describe('return values', () => {
        it('should return correct values from dependencies', () => {
            const mockAmount = new Decimal(15)
            const mockDestination = 'DEST_ADDRESS'
            const mockNote = 'Test note'
            const mockParams = { minFee: 1000 }
            const mockCurrentBalance = {
                amount: new Decimal(100),
                fiatValue: new Decimal(200),
            }

            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAsset: mockSelectedAsset,
                amount: mockAmount,
                destination: mockDestination,
                note: mockNote,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })
            ;(useSuggestedParametersQuery as Mock).mockReturnValue({
                data: mockParams,
                isPending: false,
            })
            ;(useAccountAssetBalanceQuery as Mock).mockReturnValue({
                data: mockCurrentBalance,
                isPending: false,
            })
            ;(useCurrency as Mock).mockReturnValue({
                preferredFiatCurrency: 'EUR',
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.selectedAccount).toEqual(mockAccount)
            expect(result.current.selectedAsset).toEqual(mockSelectedAsset)
            expect(result.current.amount).toEqual(mockAmount)
            expect(result.current.destination).toEqual(mockDestination)
            expect(result.current.note).toEqual(mockNote)
            expect(result.current.params).toEqual(mockParams)
            expect(result.current.paramsPending).toBe(false)
            expect(result.current.currentBalance).toEqual(mockCurrentBalance)
            expect(result.current.currentBalancePending).toBe(false)
            expect(result.current.preferredFiatCurrency).toBe('EUR')
        })
    })
})
