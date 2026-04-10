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

import React from 'react'
import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionDetailsScreen } from '../TransactionDetailsScreen'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

const mockPush = vi.fn()
const mockRoute = {
    params: {} as Record<string, unknown>,
}

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            push: mockPush,
        }),
        useRoute: () => mockRoute,
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useTransactionDetailQuery: vi.fn(() => ({
        data: undefined,
        isLoading: false,
    })),
    useGroupTransactionsQuery: vi.fn(() => ({
        groupTransactions: [],
        isLoading: false,
        isError: false,
        error: null,
    })),
}))

vi.mock('@modules/transactions/components/TransactionDisplay', () => ({
    TransactionDisplay: vi.fn(({ transaction }) =>
        React.createElement(
            'div',
            { 'data-testid': 'transaction-display' },
            transaction.id,
        ),
    ),
}))

vi.mock('@modules/transactions/components/transaction-details', () => ({
    GroupTransactionsPanel: vi.fn(
        ({ groupTransactions, onGroupTransactionPress }) =>
            React.createElement(
                'div',
                { 'data-testid': 'group-transactions-panel' },
                groupTransactions.map(
                    (tx: PeraDisplayableTransaction, i: number) =>
                        React.createElement(
                            'button',
                            {
                                key: i,
                                'data-testid': `group-tx-${tx.id}`,
                                onClick: () => onGroupTransactionPress?.(tx),
                            },
                            tx.id,
                        ),
                ),
            ),
    ),
}))

// Import after mocks
const { useTransactionDetailQuery, useGroupTransactionsQuery } =
    await import('@perawallet/wallet-core-blockchain')

describe('TransactionDetailsScreen', () => {
    const mockTransaction = {
        id: 'TX1',
        txType: 'pay',
        sender: 'SENDER_ADDR',
        paymentTransaction: {
            receiver: 'RECEIVER_ADDR',
            amount: BigInt(1_000_000),
        },
    } as unknown as PeraDisplayableTransaction

    beforeEach(() => {
        vi.clearAllMocks()
        mockRoute.params = {}

        vi.mocked(useTransactionDetailQuery).mockReturnValue({
            data: undefined,
            isLoading: false,
        } as ReturnType<typeof useTransactionDetailQuery>)

        vi.mocked(useGroupTransactionsQuery).mockReturnValue({
            groupTransactions: [],
            isLoading: false,
            isError: false,
            error: null,
        })
    })

    it('renders TransactionDisplay when transaction is provided via params', () => {
        mockRoute.params = { transaction: mockTransaction }

        const { container } = render(<TransactionDetailsScreen />)

        expect(container.textContent).toContain('TX1')
    })

    it('renders loading view when fetching by transactionId', () => {
        mockRoute.params = { transactionId: 'TX1' }

        vi.mocked(useTransactionDetailQuery).mockReturnValue({
            data: undefined,
            isLoading: true,
        } as ReturnType<typeof useTransactionDetailQuery>)

        const { container } = render(<TransactionDetailsScreen />)

        // Should show loading indicator, not the transaction display
        expect(
            container.querySelector('[data-testid="transaction-display"]'),
        ).toBeNull()
    })

    it('renders GroupTransactionsPanel when groupTransactions has >1 items', () => {
        const groupTxs = [
            mockTransaction,
            {
                ...mockTransaction,
                id: 'TX2',
            } as unknown as PeraDisplayableTransaction,
        ]

        mockRoute.params = {
            transaction: mockTransaction,
            groupId: 'GROUP1',
        }

        vi.mocked(useGroupTransactionsQuery).mockReturnValue({
            groupTransactions: groupTxs,
            isLoading: false,
            isError: false,
            error: null,
        })

        const { container } = render(<TransactionDetailsScreen />)

        expect(
            container.querySelector('[data-testid="group-transactions-panel"]'),
        ).toBeTruthy()
    })

    it('does not render GroupTransactionsPanel when no groupId', () => {
        mockRoute.params = { transaction: mockTransaction }

        vi.mocked(useGroupTransactionsQuery).mockReturnValue({
            groupTransactions: [],
            isLoading: false,
            isError: false,
            error: null,
        })

        const { container } = render(<TransactionDetailsScreen />)

        expect(
            container.querySelector('[data-testid="group-transactions-panel"]'),
        ).toBeNull()
    })

    it('does not render GroupTransactionsPanel when only 1 transaction in group', () => {
        mockRoute.params = {
            transaction: mockTransaction,
            groupId: 'GROUP1',
        }

        vi.mocked(useGroupTransactionsQuery).mockReturnValue({
            groupTransactions: [mockTransaction],
            isLoading: false,
            isError: false,
            error: null,
        })

        const { container } = render(<TransactionDetailsScreen />)

        expect(
            container.querySelector('[data-testid="group-transactions-panel"]'),
        ).toBeNull()
    })

    it('passes onInnerTransactionsPress to TransactionDisplay', async () => {
        mockRoute.params = {
            transaction: mockTransaction,
            groupId: 'GROUP1',
        }

        render(<TransactionDetailsScreen />)

        // Verify that TransactionDisplay was rendered with the transaction
        const { TransactionDisplay: MockedDisplay } =
            await import('@modules/transactions/components/TransactionDisplay')
        expect(MockedDisplay).toHaveBeenCalledWith(
            expect.objectContaining({
                transaction: mockTransaction,
                onInnerTransactionsPress: expect.any(Function),
            }),
            undefined,
        )
    })

    it('renders empty view when no transaction data', () => {
        mockRoute.params = { transactionId: 'TX_MISSING' }

        vi.mocked(useTransactionDetailQuery).mockReturnValue({
            data: undefined,
            isLoading: false,
        } as ReturnType<typeof useTransactionDetailQuery>)

        const { container } = render(<TransactionDetailsScreen />)

        // Should show empty view, not transaction display
        expect(
            container.querySelector('[data-testid="transaction-display"]'),
        ).toBeNull()
    })
})
