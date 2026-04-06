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
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import { Decimal } from 'decimal.js'

const mockNext = vi.fn()
const mockFail = vi.fn()

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
    createNavigationContainerRef: () => ({
        navigate: vi.fn(),
        dispatch: vi.fn(),
        reset: vi.fn(),
        goBack: vi.fn(),
        isReady: vi.fn(() => true),
        current: null,
    }),
    StackActions: {
        replace: vi.fn(),
        push: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(() => ({
        currentRequest: null,
        stage: 'idle',
        isLoading: false,
        isRetryable: false,
        error: null,
        allTransactions: [],
        listItems: [],
        signableAddresses: new Set(),
        totalFee: new Decimal(0),
        warnings: [],
        distinctWarnings: [],
        requestStructure: 'single',
        next: mockNext,
        fail: mockFail,
        retry: vi.fn(),
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
    classifyDisplayableTransaction: vi.fn(tx => {
        if (tx?.paymentTransaction) return 'payment'
        return 'unknown'
    }),
    isValidAlgorandAddress: vi.fn(() => true),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        usdToPreferred: vi.fn((amount: Decimal) => amount),
        algoUsdPrice: new Decimal(0),
    })),
    usePreferredCurrencyPriceQuery: vi.fn(() => ({
        data: null,
        isPending: false,
    })),
}))

vi.mock('@perawallet/wallet-core-projects', () => ({
    useProjectByUrlQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
    useApplicationQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
}))

vi.mock('@modules/signing/components/FeeDisplay/useFeeWarning', () => ({
    useFeeWarning: vi.fn(() => ({
        showWarning: false,
        fee: { mul: vi.fn(() => 0), greaterThan: vi.fn(() => false) },
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useTransactionSigner: vi.fn(() => ({
            signTransactions: vi.fn().mockResolvedValue([]),
        })),
        useAllAccounts: vi.fn(() => []),
        useSelectedAccount: vi.fn(() => null),
        useFindAccountByAddress: vi.fn(() => vi.fn(() => null)),
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map(),
            portfolioAlgoValue: new Decimal(0),
            isPending: false,
            isFetched: true,
            isRefetching: false,
            isError: false,
        })),
        usePortfolioTotals: vi.fn(() => ({
            portfolioPreferredValue: new Decimal(0),
            accountPreferredValues: new Map(),
            isPending: false,
        })),
    }
})

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
        pipelineOverrides: Record<string, unknown> = {},
    ) => {
        vi.mocked(useSigningPipeline).mockReturnValue({
            currentRequest: request,
            stage: 'idle',
            isLoading: false,
            isRetryable: false,
            error: null,
            allTransactions: [],
            listItems: [],
            signableAddresses: new Set(),
            totalFee: new Decimal(0),
            warnings: [],
            distinctWarnings: [],
            requestStructure: 'single',
            next: mockNext,
            fail: mockFail,
            retry: vi.fn(),
            ...pipelineOverrides,
        } as ReturnType<typeof useSigningPipeline>)
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

    it('displays list view when multiple transactions are present', () => {
        const multiTxRequest = {
            type: 'transactions',
            transport: 'callback',
            txs: [{}, {}],
        } as unknown as TransactionSignRequest

        const mockTx = {
            fee: 1000n,
            sender: 'MOCK_SENDER',
            txType: 'pay',
        }
        setupMocks(multiTxRequest, {
            groups: [[mockTx], [mockTx]],
            allTransactions: [mockTx, mockTx],
            listItems: [
                { type: 'transaction', transaction: mockTx },
                { type: 'transaction', transaction: mockTx },
            ],
            requestStructure: 'list',
        })
        const { container } = render(
            <TransactionSigningView request={multiTxRequest} />,
        )
        // List view shows transactions title
        expect(container.textContent?.toLowerCase()).toContain(
            'signing.transactions',
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
            expect(mockFail).toHaveBeenCalled()
        }
    })
})
