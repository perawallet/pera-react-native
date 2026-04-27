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
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SingleTransactionScreen } from '../SingleTransactionScreen'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
}))

vi.mock('@modules/signing/components/TransactionSummaryHeader', () => ({
    TransactionSummaryHeader: vi.fn(() =>
        React.createElement('div', { 'data-testid': 'transaction-summary' }),
    ),
}))

vi.mock('@modules/signing/components/FeeDisplay', () => ({
    FeeDisplay: vi.fn(() =>
        React.createElement('div', { 'data-testid': 'fee-display' }),
    ),
}))

vi.mock('@modules/signing/components/SigningWarnings', () => ({
    SigningWarnings: vi.fn(() =>
        React.createElement('div', { 'data-testid': 'signing-warnings' }),
    ),
}))

vi.mock(
    '@modules/signing/components/SigningAccountDisplay/SigningAccountDisplay',
    () => ({
        SigningAccountDisplay: vi.fn(() =>
            React.createElement('div', {
                'data-testid': 'signing-account-display',
            }),
        ),
    }),
)

vi.mock('@modules/signing/components/SigningActionButtons', () => ({
    SigningActionButtons: vi.fn(() =>
        React.createElement('div', { 'data-testid': 'signing-action-buttons' }),
    ),
}))

const { useSigningPipeline } = await import('@perawallet/wallet-core-signing')

describe('SingleTransactionScreen', () => {
    const mockTransaction = {
        id: 'tx-1',
        txType: 'pay',
        sender: 'SENDER_ADDR',
    } as unknown as PeraDisplayableTransaction

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the transaction summary when a request and transaction are present', () => {
        vi.mocked(useSigningPipeline).mockReturnValue({
            currentRequest: {
                id: 'req-1',
                type: 'transactions',
                txs: [{} as unknown as PeraDisplayableTransaction],
            },
            allTransactions: [mockTransaction],
        } as unknown as ReturnType<typeof useSigningPipeline>)

        render(<SingleTransactionScreen />)

        expect(screen.getByTestId('transaction-summary')).toBeTruthy()
    })

    it('shows the invalid-transaction empty state when the request exists but has no displayable transaction', () => {
        vi.mocked(useSigningPipeline).mockReturnValue({
            currentRequest: {
                id: 'req-1',
                type: 'transactions',
                txs: [{} as unknown as PeraDisplayableTransaction],
            },
            allTransactions: [],
        } as unknown as ReturnType<typeof useSigningPipeline>)

        render(<SingleTransactionScreen />)

        expect(
            screen.getByText('signing.transaction_view.invalid_title'),
        ).toBeTruthy()
        expect(
            screen.getByText('signing.transaction_view.invalid_body'),
        ).toBeTruthy()
    })

    it('does not flash the invalid-transaction empty state during request teardown (PERA-3341)', () => {
        // After signing completes, the actor clears the request from the store
        // before the bottom sheet finishes animating closed. In that window the
        // pipeline reports `currentRequest = undefined` and `allTransactions = []`.
        // Eric reported (PERA-3341) seeing "Invalid transaction" briefly flash on
        // Tinyman pool creation, where ARC-0001 narrows `txs` to the single
        // user-signable transaction so the user is on this screen.
        vi.mocked(useSigningPipeline).mockReturnValue({
            currentRequest: undefined,
            allTransactions: [],
        } as unknown as ReturnType<typeof useSigningPipeline>)

        const { container } = render(<SingleTransactionScreen />)

        expect(
            screen.queryByText('signing.transaction_view.invalid_title'),
        ).toBeNull()
        expect(
            screen.queryByText('signing.transaction_view.invalid_body'),
        ).toBeNull()
        expect(container.firstChild).toBeNull()
    })
})
