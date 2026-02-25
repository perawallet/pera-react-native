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
import { useTransactionProcessingScreen } from '../useTransactionProcessingScreen'
import Decimal from 'decimal.js'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'

const mockReplace = vi.fn()
const mockGoBack = vi.fn()
const mockRemove = vi.fn()

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: mockRemove })),
    },
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        replace: mockReplace,
        goBack: mockGoBack,
    }),
}))

vi.mock('@react-navigation/stack', () => ({}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useTransactionSigner: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
    ALGO_ASSET_ID: '0',
    ALGO_ASSET: { id: '0', decimals: 6 },
    toDecimalUnits: (value: number | Decimal) => {
        if (value instanceof Decimal) {
            return value
        }
        return new Decimal(value)
    },
}))

vi.mock('@perawallet/wallet-core-asa-inbox', () => ({
    useArc59Transaction: vi.fn(() => ({
        sendViaInbox: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: vi.fn(),
    useExpressTransaction: vi.fn(() => ({
        sendExpress: vi.fn(),
    })),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('i18next', () => ({
    t: (key: string) => {
        const translations: Record<string, string> = {
            'transactions.invalid_title': 'Invalid transaction',
            'transactions.invalid_body':
                'Something appears to have gone wrong with this transaction.',
        }
        return translations[key] ?? key
    },
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

describe('useTransactionProcessingScreen', () => {
    const mockShowToast = vi.fn()
    const mockSignTransactions = vi.fn()
    const mockPayment = vi.fn()
    const mockAssetTransfer = vi.fn()

    const mockAccount = {
        address: 'TEST_ADDRESS',
        name: 'Test Account',
    }

    const mockAlgoAsset = { assetId: '0' }
    const mockSelectedAsset = { assetId: '123' }

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

    const mockAlgokit = {
        send: {
            payment: mockPayment,
            assetTransfer: mockAssetTransfer,
        },
    }

    const mockSendFundsState = {
        selectedAsset: undefined,
        amount: undefined,
        destination: undefined,
        note: undefined,
        sendMode: 'normal' as const,
        arc59Summary: undefined,
        isCloseAccount: false,
        onFinished: vi.fn(),
        canSelectAsset: true,
        setSelectedAsset: vi.fn(),
        setCanSelectAsset: vi.fn(),
        setAmount: vi.fn(),
        setNote: vi.fn(),
        setDestination: vi.fn(),
        setOnFinished: vi.fn(),
        setSendMode: vi.fn(),
        setArc59Summary: vi.fn(),
        reset: vi.fn(),
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
        ;(useSendFunds as Mock).mockReturnValue(mockSendFundsState)
    })

    it('should send ALGO payment and navigate to success', async () => {
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
        mockPayment.mockResolvedValue({ txIds: ['PAYMENT_TX_ID'] })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockPayment).toHaveBeenCalledWith({
            sender: 'TEST_ADDRESS',
            receiver: 'DEST_ADDRESS',
            amount: expect.any(BigInt),
            note: 'Test note',
        })
        expect(mockReplace).toHaveBeenCalledWith('TransactionSuccess', {
            transactionId: 'PAYMENT_TX_ID',
        })
    })

    it('should send ASA transfer and navigate to success', async () => {
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
        mockAssetTransfer.mockResolvedValue({ txIds: ['ASSET_TX_ID'] })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
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
        expect(mockReplace).toHaveBeenCalledWith('TransactionSuccess', {
            transactionId: 'ASSET_TX_ID',
        })
    })

    it('should show error toast and go back when required data is missing', async () => {
        ;(useSelectedAccount as Mock).mockReturnValue(null)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAsset: undefined,
            amount: undefined,
            destination: undefined,
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'Invalid transaction',
                body: 'Something appears to have gone wrong with this transaction.',
                type: 'error',
            },
            { notifier: undefined },
        )
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('should show error toast and go back on transaction failure', async () => {
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

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'Error sending transaction',
                body: `${mockError}`,
                type: 'error',
            },
            { notifier: undefined },
        )
        expect(mockGoBack).toHaveBeenCalled()
    })
})
