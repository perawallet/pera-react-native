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
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import { useTransactionSendFlow } from '@perawallet/wallet-core-transactions'

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
    useAccountBalancesInvalidator: vi.fn(() => ({ invalidate: vi.fn() })),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionSendFlow: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'transactions.processing_error.title': 'Invalid transaction',
                'transactions.processing_error.body':
                    'Something appears to have gone wrong with this transaction.',
            }
            return translations[key] ?? key
        },
    }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
}))

describe('useTransactionProcessingScreen', () => {
    const mockShowToast = vi.fn()
    const mockExecute = vi.fn()

    const mockAccount = {
        address: 'TEST_ADDRESS',
        name: 'Test Account',
    }

    const mockAsset = { id: '123', name: 'Test Asset' }

    const mockSendFundsState = {
        selectedAssetId: undefined as string | undefined,
        amount: undefined,
        destination: undefined,
        note: undefined,
        sendMode: 'normal' as const,
        arc59Summary: undefined,
        isCloseAccount: false,
        onFinished: vi.fn(),
        canSelectAsset: true,
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
        mockExecute.mockResolvedValue('TX_ID_123')
        ;(useToast as Mock).mockReturnValue({
            showToast: mockShowToast,
        })
        ;(useSelectedAccount as Mock).mockReturnValue(null)
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([['123', mockAsset]]),
        })
        ;(useTransactionSendFlow as Mock).mockReturnValue({
            execute: mockExecute,
        })
        ;(useSendFunds as Mock).mockReturnValue(mockSendFundsState)
    })

    it('should call execute with correct SendTransactionParams when data is valid', async () => {
        ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
            note: 'Test note',
            sendMode: 'normal',
            isCloseAccount: false,
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                sendMode: 'normal',
                sender: mockAccount,
                receiver: 'DEST_ADDRESS',
                asset: mockAsset,
                amount: new Decimal(5),
                note: 'Test note',
                isCloseAccount: false,
                arc59Summary: undefined,
            }),
        })
    })

    it('should call execute even when data is missing (delegates validation)', async () => {
        ;(useSelectedAccount as Mock).mockReturnValue(null)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: undefined,
            amount: undefined,
            destination: undefined,
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                sendMode: 'normal',
                sender: null,
                receiver: undefined,
                asset: undefined,
                amount: undefined,
            }),
        })
    })

    it('should show error toast and go back when execute rejects', async () => {
        const mockError = new Error('Network error')
        mockExecute.mockRejectedValue(mockError)
        ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
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

    it('should navigate to TransactionSuccess on successful execute', async () => {
        mockExecute.mockResolvedValue('TX_ID_123')
        ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockReplace).toHaveBeenCalledWith('TransactionSuccess', {
            transactionId: 'TX_ID_123',
        })
    })

    it('should include arc59Summary when sendMode is sendArc59', async () => {
        const arc59Summary = {
            is_arc59_opted_in: true,
            minimum_balance_requirement: 100000,
            inner_tx_count: 2,
            total_protocol_and_mbr_fee: 200000,
            inbox_address: 'INBOX_ADDR',
            algo_fund_amount: 0,
            warning_message: null,
        }

        ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
            sendMode: 'sendArc59',
            arc59Summary,
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                sendMode: 'sendArc59',
                arc59Summary,
            }),
        })
    })

    it('should set up BackHandler to prevent hardware back press', async () => {
        const { BackHandler } = await import('react-native')

        ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(BackHandler.addEventListener).toHaveBeenCalledWith(
            'hardwareBackPress',
            expect.any(Function),
        )
    })
})
