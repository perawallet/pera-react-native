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
import { describe, it, expect, vi } from 'vitest'
import { InnerTransactionPreview } from '../InnerTransactionPreview'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS_TEST123'),
        getTransactionType: vi.fn((tx: PeraDisplayableTransaction) => {
            if (tx.txType === 'pay') return 'payment'
            if (tx.txType === 'appl') return 'app-call'
            return 'unknown'
        }),
        microAlgosToAlgos: vi.fn(
            (amount: bigint) => Number(amount) / 1_000_000,
        ),
    }
})

describe('InnerTransactionPreview', () => {
    const mockPaymentTransaction = {
        sender: 'ENCODED_ADDRESS_TEST123',
        paymentTransaction: {
            receiver: 'ENCODED_ADDRESS_TEST123',
            amount: BigInt(1_000_000),
        },
        txType: 'pay',
    } as unknown as PeraDisplayableTransaction

    const mockAppCallTransaction = {
        sender: 'ENCODED_ADDRESS_TEST123',
        applicationTransaction: {
            applicationId: BigInt(123),
            innerTransactions: [
                { sender: 'ENCODED_ADDRESS_TEST123' },
                { sender: 'ENCODED_ADDRESS_TEST123' },
            ],
        },
        txType: 'appl',
    } as unknown as PeraDisplayableTransaction

    it('renders sender address for unknown transaction types', () => {
        const mockUnknownTransaction = {
            ...mockPaymentTransaction,
            txType: 'unknown',
            paymentTransaction: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <InnerTransactionPreview transaction={mockUnknownTransaction} />,
        )

        expect(container.textContent).toContain('ENCODED')
    })

    it('calls onPress when pressed', () => {
        const onPress = vi.fn()
        const { container } = render(
            <InnerTransactionPreview
                transaction={mockPaymentTransaction}
                onPress={onPress}
            />,
        )

        const touchable = container.firstChild
        if (touchable) {
            fireEvent.click(touchable as Element)
            expect(onPress).toHaveBeenCalled()
        }
    })

    it('displays payment amount for payment transactions', () => {
        const { container } = render(
            <InnerTransactionPreview transaction={mockPaymentTransaction} />,
        )

        expect(container.textContent).toContain('ALGO')
    })

    it('renders without crashing for app call transaction', () => {
        const { container } = render(
            <InnerTransactionPreview transaction={mockAppCallTransaction} />,
        )

        expect(container).toBeTruthy()
    })
})
