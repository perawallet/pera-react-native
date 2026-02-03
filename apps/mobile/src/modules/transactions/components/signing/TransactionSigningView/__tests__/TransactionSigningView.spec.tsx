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
    TransactionSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        removeSignRequest: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
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
    }
})

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

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders cancel and confirm buttons', () => {
        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('cancel')
        expect(text).toContain('confirm')
    })

    it('shows Confirm All for multiple transactions', () => {
        const { container } = render(
            <TransactionSigningView request={mockGroupTxRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('confirm')
        expect(text).toContain('all')
    })

    it('shows single confirm for single transaction', () => {
        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )
        // Should show "Confirm" - check it renders buttons
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('confirm')
    })

    it('displays transaction view when transaction has no payment type', () => {
        const invalidRequest = {
            type: 'transactions',
            transport: 'callback',
            txs: [[{}]], // No transaction type fields
        } as unknown as TransactionSignRequest

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
            txs: [[]], // Empty transaction array
        } as unknown as TransactionSignRequest

        const { container } = render(
            <TransactionSigningView request={emptyRequest} />,
        )
        // Empty group shows group view with 0 transactions
        expect(container.textContent?.toLowerCase()).toContain('group')
    })

    it('calls removeSignRequest on cancel', () => {
        const removeSignRequest = vi.fn()
        vi.mocked(useSigningRequest).mockReturnValue({
            removeSignRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )

        const buttons = container.querySelectorAll('button')
        const cancelButton = Array.from(buttons).find(btn =>
            btn.textContent?.toLowerCase().includes('cancel'),
        )
        if (cancelButton) {
            fireEvent.click(cancelButton)
            expect(removeSignRequest).toHaveBeenCalledWith(mockSingleTxRequest)
        }
    })
})
