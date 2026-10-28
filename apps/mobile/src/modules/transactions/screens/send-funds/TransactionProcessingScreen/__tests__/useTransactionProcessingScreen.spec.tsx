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
import { useTransactionProcessingScreen } from '../useTransactionProcessingScreen'
import { Decimal } from 'decimal.js'
import {
    accountKindIdOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { AnalyticsMetadataKey, TransactionsEvent } from '@analytics'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useErrorToast } from '@hooks/useErrorToast'
import { useSendFunds } from '@modules/transactions/hooks'
import { useTransactionSendFlow } from '@perawallet/wallet-core-transactions'
import type { Optional } from '@perawallet/wallet-core-shared'
import { registerEthereumChain } from '@test-utils/chain-fixtures'

const { mockTrackEvent, mockUseSendScope } = vi.hoisted(() => ({
    mockTrackEvent: vi.fn(),
    mockUseSendScope: vi.fn(),
}))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

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
    accountKindIdOf: vi.fn(() => 'standalone'),
    useAccountBalancesInvalidator: vi.fn(() => ({ invalidate: vi.fn() })),
    chainAccountOf: (
        account: { chains: Record<string, unknown> },
        chainId: string,
    ) => account.chains[chainId],
    // The processing-screen hook derives Ledger-aware copy from these; the
    // existing tests focus on send-pipeline routing and don't care about
    // the copy branch, so a minimal stub keeps them green.
    hardwareDetailsOf: vi.fn(() => undefined),
    isHardwareWalletAccount: vi.fn(() => false),
    useAllAccounts: vi.fn(() => []),
    resolveAuthAccount: vi.fn((account: unknown) => account),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionSendFlow: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
    useSendScope: mockUseSendScope,
}))

vi.mock('@hooks/useLanguage')

describe('useTransactionProcessingScreen', () => {
    const mockShowError = vi.fn()
    const mockExecute = vi.fn()

    const mockAccount = {
        id: 'test-account',
        name: 'Test Account',
        custody: { kind: 'local', seed: null },
        chains: { algorand: { address: 'TEST_ADDRESS' } },
    }

    const mockAsset = { id: '123', name: 'Test Asset' }

    const mockSendFundsState = {
        selectedAssetId: undefined as Optional<string>,
        amount: undefined,
        destination: undefined,
        note: undefined,
        sendMode: 'normal' as const,
        assetInboxQuote: undefined,
        isCloseAccount: false,
        onFinished: vi.fn(),
        canSelectAsset: true,
        setCanSelectAsset: vi.fn(),
        setAmount: vi.fn(),
        setNote: vi.fn(),
        setDestination: vi.fn(),
        setOnFinished: vi.fn(),
        setSendMode: vi.fn(),
        setAssetInboxQuote: vi.fn(),
        reset: vi.fn(),
    }

    beforeEach(() => {
        registerEthereumChain()
        vi.clearAllMocks()
        mockUseSendScope.mockReturnValue({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        mockExecute.mockResolvedValue('TX_ID_123')
        ;(useErrorToast as Mock).mockReturnValue({
            showError: mockShowError,
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
                assetInboxQuote: undefined,
            }),
        })
    })

    // The mount-only submit effect is the whole reason this hook uses an empty
    // dependency array — a re-run is a duplicate send.
    it('submits exactly once across re-renders (regression)', async () => {
        ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
        })

        const { rerender } = renderHook(() => useTransactionProcessingScreen())

        await act(async () => {})
        expect(mockExecute).toHaveBeenCalledTimes(1)

        await act(async () => {
            rerender()
        })

        expect(mockExecute).toHaveBeenCalledTimes(1)
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

        expect(mockShowError).toHaveBeenCalledWith(mockError, undefined, {
            notifier: undefined,
        })
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

    it("reports the sender's account kind id with the completed send", async () => {
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

        expect(accountKindIdOf).toHaveBeenCalledWith(mockAccount, 'algorand')
        expect(mockTrackEvent).toHaveBeenCalledWith(
            TransactionsEvent.Complete,
            {
                [AnalyticsMetadataKey.AssetId]: '123',
                [AnalyticsMetadataKey.Amount]: 5,
                [AnalyticsMetadataKey.TransactionId]: 'TX_ID_123',
                [AnalyticsMetadataKey.AccountType]: 'standalone',
                [AnalyticsMetadataKey.ChainId]: 'algorand',
            },
        )
    })

    it('reports the send scope chain with the completed send', async () => {
        mockUseSendScope.mockReturnValue({
            chainId: 'ethereum',
            networkId: 'mainnet',
        })
        ;(useSelectedAccount as Mock).mockReturnValue({
            ...mockAccount,
            chains: { ethereum: { address: '0xTEST' } },
        })
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: '0xDEST',
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            TransactionsEvent.Complete,
            expect.objectContaining({
                [AnalyticsMetadataKey.ChainId]: 'ethereum',
            }),
        )
    })

    it('carries the inbox quote into an asset inbox send', async () => {
        const assetInboxQuote = { opaque: true }

        ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
        ;(useSendFunds as Mock).mockReturnValue({
            ...mockSendFundsState,
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
            sendMode: 'sendAssetInbox',
            assetInboxQuote,
        })

        await act(async () => {
            renderHook(() => useTransactionProcessingScreen())
        })

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                sendMode: 'sendAssetInbox',
                assetInboxQuote,
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
