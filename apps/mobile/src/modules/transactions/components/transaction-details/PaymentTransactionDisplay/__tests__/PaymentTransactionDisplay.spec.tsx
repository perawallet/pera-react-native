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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PaymentTransactionDisplay } from '../PaymentTransactionDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        microAlgosToAlgos: vi.fn(
            (amount: bigint) => Number(amount) / 1_000_000,
        ),
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS'),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: vi.fn(() => []),
    }
})

describe('PaymentTransactionDisplay', () => {
    const mockTransaction = {
        sender: 'SENDER_ADDRESS',
        fee: 1000n,
        paymentTransaction: {
            receiver: 'RECEIVER_ADDRESS',
            amount: 1000000n,
        },
        confirmedRound: 100n,
        txType: 'pay',
    } as unknown as PeraDisplayableTransaction

    it('renders amount correctly', () => {
        const { container } = render(
            <PaymentTransactionDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('ALGO1')
    })

    it('renders sender and receiver addresses', () => {
        const { container } = render(
            <PaymentTransactionDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('SENDER_ADDRESS')
        expect(container.textContent).toContain('RECEIVER_ADDRESS')
    })

    it('renders fee correctly', () => {
        const { container } = render(
            <PaymentTransactionDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('ALGO0.001')
    })

    it('renders null if paymentTransaction is missing', () => {
        const invalidTx = {
            ...mockTransaction,
            paymentTransaction: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <PaymentTransactionDisplay transaction={invalidTx} />,
        )

        expect(container.firstChild).toBeNull()
    })
})
