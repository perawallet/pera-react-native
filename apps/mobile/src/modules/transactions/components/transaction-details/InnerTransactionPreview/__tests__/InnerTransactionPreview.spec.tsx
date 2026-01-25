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
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS_TEST123'),
        getTransactionType: vi.fn(() => 'payment'),
        microAlgosToAlgos: vi.fn(
            (amount: bigint) => Number(amount) / 1_000_000,
        ),
    }
})

describe('InnerTransactionPreview', () => {
    const mockPaymentTransaction = {
        sender: { publicKey: new Uint8Array(32) },
        payment: {
            receiver: { publicKey: new Uint8Array(32) },
            amount: BigInt(1_000_000),
        },
    } as unknown as PeraTransaction

    const mockAppCallTransaction = {
        sender: { publicKey: new Uint8Array(32) },
        appCall: {
            appId: BigInt(123),
            innerTransactions: [
                { sender: { publicKey: new Uint8Array(32) } },
                { sender: { publicKey: new Uint8Array(32) } },
            ],
        },
    } as unknown as PeraTransaction

    it('renders payment transaction with sender address', () => {
        const { container } = render(
            <InnerTransactionPreview transaction={mockPaymentTransaction} />,
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
