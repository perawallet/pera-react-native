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
import { AppCallTransactionDisplay } from '../AppCallTransactionDisplay'
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

describe('AppCallTransactionDisplay', () => {
    const mockTransaction = {
        sender: 'SENDER_ADDRESS',
        fee: 1000n,
        applicationTransaction: {
            applicationId: 123n,
            onCompletion: 'NoOp',
        },
        id: 'TX_ID',
        txType: 'appl',
        innerTxns: [],
    } as unknown as PeraDisplayableTransaction

    it('renders application ID correctly', () => {
        const { container } = render(
            <AppCallTransactionDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('#123')
    })

    it('renders onCompletion correctly', () => {
        const { container } = render(
            <AppCallTransactionDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('NoOp')
    })

    it('renders fee correctly', () => {
        const { container } = render(
            <AppCallTransactionDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('ALGO0.001')
    })

    it('renders null if applicationTransaction is missing', () => {
        const invalidTx = {
            ...mockTransaction,
            applicationTransaction: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <AppCallTransactionDisplay transaction={invalidTx} />,
        )

        expect(container.firstChild).toBeNull()
    })
})
