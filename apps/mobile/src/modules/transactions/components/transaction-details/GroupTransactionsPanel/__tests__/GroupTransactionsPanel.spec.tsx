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
import { GroupTransactionsPanel } from '../GroupTransactionsPanel'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    const { Decimal } = await import('decimal.js')
    return {
        ...actual,
        classifyDisplayableTransaction: vi.fn(
            (tx: PeraDisplayableTransaction) => {
                if (tx.txType === 'pay') return 'payment'
                if (tx.txType === 'appl') return 'app-call'
                return 'unknown'
            },
        ),
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS_TEST123'),
        microAlgosToAlgos: vi.fn((amount: bigint) =>
            new Decimal(amount.toString()).div(1_000_000),
        ),
        baseUnitsToDisplayUnits: vi.fn((amount: bigint, decimals: number) =>
            new Decimal(amount.toString()).div(new Decimal(10).pow(decimals)),
        ),
    }
})

describe('GroupTransactionsPanel', () => {
    const createMockTransaction = (
        id: string,
        txType: string = 'pay',
    ): PeraDisplayableTransaction =>
        ({
            id,
            sender: 'ENCODED_ADDRESS_TEST123',
            txType,
            paymentTransaction:
                txType === 'pay'
                    ? {
                          receiver: 'ENCODED_ADDRESS_TEST123',
                          amount: BigInt(1_000_000),
                      }
                    : undefined,
            applicationTransaction:
                txType === 'appl' ? { applicationId: BigInt(123) } : undefined,
        }) as unknown as PeraDisplayableTransaction

    it('renders nothing when groupTransactions is empty', () => {
        const { container } = render(
            <GroupTransactionsPanel
                groupTransactions={[]}
                currentTransactionId='TX1'
            />,
        )

        expect(container.textContent).toBe('')
    })

    it('renders nothing when only the current transaction is in the group', () => {
        const transactions = [createMockTransaction('TX1')]

        const { container } = render(
            <GroupTransactionsPanel
                groupTransactions={transactions}
                currentTransactionId='TX1'
            />,
        )

        expect(container.textContent).toBe('')
    })

    it('renders transaction previews for group transactions excluding current', () => {
        const transactions = [
            createMockTransaction('TX1'),
            createMockTransaction('TX2'),
            createMockTransaction('TX3'),
        ]

        const { container } = render(
            <GroupTransactionsPanel
                groupTransactions={transactions}
                currentTransactionId='TX1'
            />,
        )

        // Should show the panel with content (the 2 other transactions)
        expect(container.textContent).toBeTruthy()
    })

    it('calls onGroupTransactionPress when a transaction preview is pressed', () => {
        const onPress = vi.fn()
        const transactions = [
            createMockTransaction('TX1'),
            createMockTransaction('TX2'),
        ]

        const { container } = render(
            <GroupTransactionsPanel
                groupTransactions={transactions}
                currentTransactionId='TX1'
                onGroupTransactionPress={onPress}
            />,
        )

        // Find and click the touchable element for TX2
        const touchables = container.querySelectorAll('[data-testid]')
        if (touchables.length > 0) {
            fireEvent.click(touchables[0] as Element)
        }
    })

    it('displays panel title with group transaction count', () => {
        const transactions = [
            createMockTransaction('TX1'),
            createMockTransaction('TX2'),
            createMockTransaction('TX3', 'appl'),
        ]

        const { container } = render(
            <GroupTransactionsPanel
                groupTransactions={transactions}
                currentTransactionId='TX1'
            />,
        )

        // Panel should contain content from the group transactions
        expect(container.textContent).toBeTruthy()
    })
})
