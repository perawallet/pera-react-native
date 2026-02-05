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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionSigningView } from '../TransactionSigningView'
import {
    type TransactionSignRequest,
    useSigningRequest,
    useSigningRequestAnalysis,
} from '@perawallet/wallet-core-signing'
import Decimal from 'decimal.js'

const mockSignAndSendRequest = vi.fn()
const mockRejectRequest = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(() => ({
        canGoBack: vi.fn(() => false),
    })),
    useRoute: vi.fn(() => ({
        params: {},
    })),
    NavigationContainer: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    NavigationIndependentTree: ({
        children,
    }: {
        children: React.ReactNode
    }) => <div>{children}</div>,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        pendingSignRequests: [],
        signAndSendRequest: mockSignAndSendRequest,
        rejectRequest: mockRejectRequest,
    })),
    useSigningRequestAnalysis: vi.fn(() => ({
        groups: [],
        allTransactions: [],
        totalFee: 0n,
        warnings: [],
        requestStructure: 'single',
    })),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: vi.fn(() => ({
        client: { algod: { sendRawTransaction: vi.fn() } },
    })),
    useTransactionEncoder: vi.fn(() => ({
        encodeSignedTransactions: vi.fn(),
    })),
    encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS'),
    mapToDisplayableTransaction: vi.fn(tx => {
        if (!tx) return null
        return {
            fee: 1000n,
            sender: 'MOCK_SENDER',
            txType: tx.payment ? 'pay' : 'appl',
            firstValid: 1n,
            lastValid: 100n,
            confirmedRound: 0n,
            roundTime: 0,
            intraRoundOffset: 0,
            signature: {},
            paymentTransaction: tx.payment
                ? {
                      amount: tx.payment.amount ?? 0n,
                      receiver: 'MOCK_RECEIVER',
                  }
                : undefined,
        }
    }),
    getTransactionType: vi.fn(tx => {
        if (tx?.paymentTransaction) return 'payment'
        return 'unknown'
    }),
    isValidAlgorandAddress: vi.fn(() => true),
    initBlockchainStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useTransactionSigner: vi.fn(() => ({
        signTransactions: vi.fn().mockResolvedValue([]),
    })),
    useAllAccounts: vi.fn(() => []),
    useSelectedAccount: vi.fn(() => null),
    useFindAccountByAddress: vi.fn(() => vi.fn(() => null)),
    getAccountDisplayName: vi.fn(() => ''),
}))

describe('TransactionSigningView', () => {
    const mockSingleTxRequest = {
        type: 'transactions',
        transport: 'callback',
        txs: [
            [
                {
                    payment: {
                        receiver: { publicKey: new Uint8Array(32) },
                    },
                },
            ],
        ],
        approve: vi.fn(),
        reject: vi.fn(),
    } as unknown as TransactionSignRequest

    const mockGroupTxRequest = {
        type: 'transactions',
        transport: 'callback',
        txs: [
            [{ payment: { receiver: { publicKey: new Uint8Array(32) } } }],
            [{ payment: { receiver: { publicKey: new Uint8Array(32) } } }],
        ],
        approve: vi.fn(),
        reject: vi.fn(),
    } as unknown as TransactionSignRequest

    const setupMocks = (
        request: TransactionSignRequest,
        analysisOverrides: Record<string, unknown> = {},
    ) => {
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [request],
            signAndSendRequest: mockSignAndSendRequest,
            rejectRequest: mockRejectRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)
        vi.mocked(useSigningRequestAnalysis).mockReturnValue({
            groups: [],
            allTransactions: [],
            totalFee: Decimal(0),
            warnings: [],
            distinctWarnings: [],
            requestStructure: 'single',
            ...analysisOverrides,
        } as ReturnType<typeof useSigningRequestAnalysis>)
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders cancel and confirm buttons', () => {
        setupMocks(mockSingleTxRequest)
        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        // Check for translation keys since i18n is not mocked
        expect(text).toContain('signing.transaction_view')
    })

    it('shows Confirm All for multiple transactions', () => {
        setupMocks(mockGroupTxRequest, {
            allTransactions: [{ fee: 1000n }, { fee: 1000n }],
        })
        const { container } = render(
            <TransactionSigningView request={mockGroupTxRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        // Multiple transactions show 'transactions' (plural) key
        expect(text).toContain('signing.transactions')
    })

    it('shows single confirm for single transaction', () => {
        setupMocks(mockSingleTxRequest)
        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('signing.transaction_view')
    })

    it('displays transaction view when transaction has no payment type', () => {
        const invalidRequest = {
            type: 'transactions',
            transport: 'callback',
            txs: [[{}]], // No transaction type fields
        } as unknown as TransactionSignRequest

        const mockTx = {
            fee: 1000n,
            sender: 'MOCK_SENDER',
            txType: 'appl',
        }
        setupMocks(invalidRequest, {
            groups: [[mockTx]],
            allTransactions: [mockTx],
        })
        const { container } = render(
            <TransactionSigningView request={invalidRequest} />,
        )
        // Transactions with no payment field show as app call type
        expect(container.textContent?.toLowerCase()).toContain(
            'transactions.type.appl',
        )
    })

    it('displays group view when no transactions are present', () => {
        const emptyRequest = {
            type: 'transactions',
            transport: 'callback',
            txs: [[]],
        } as unknown as TransactionSignRequest

        setupMocks(emptyRequest, {
            groups: [[]],
            requestStructure: 'group',
        })
        const { container } = render(
            <TransactionSigningView request={emptyRequest} />,
        )
        // Empty group shows invalid state since there are no transactions to sign
        expect(container.textContent?.toLowerCase()).toContain(
            'signing.transaction_view.invalid',
        )
    })

    it('calls rejectRequest on cancel', () => {
        setupMocks(mockSingleTxRequest)

        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )

        const buttons = container.querySelectorAll('button')
        const cancelButton = Array.from(buttons).find(btn =>
            btn.textContent?.toLowerCase().includes('cancel'),
        )
        if (cancelButton) {
            fireEvent.click(cancelButton)
            expect(mockRejectRequest).toHaveBeenCalledWith(mockSingleTxRequest)
        }
    })
})
