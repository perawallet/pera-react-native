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
import { TransactionHeader } from '../TransactionHeader'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getTransactionType: vi.fn(() => 'payment'),
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS'),
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatDatetime: vi.fn(() => 'January 1, 2024'),
    }
})

describe('TransactionHeader', () => {
    const mockTransaction = {
        id: 'TX_ID',
        txType: 'pay',
        confirmedRound: 12345n,
        roundTime: 1704067200, // 2024-01-01
    } as unknown as PeraDisplayableTransaction

    it('renders transaction type correctly', () => {
        const { container } = render(
            <TransactionHeader transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('transactions.type.pay')
    })

    it('renders transaction ID correctly', () => {
        const { container } = render(
            <TransactionHeader transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('TX_ID')
    })

    it('renders round and date correctly', () => {
        const { container } = render(
            <TransactionHeader transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('12345')
        expect(container.textContent).toContain('January 1, 2024')
    })

    it('renders pending status when ID is missing', () => {
        const pendingTx = {
            ...mockTransaction,
            id: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <TransactionHeader transaction={pendingTx} />,
        )

        expect(container.textContent).toContain('transactions.common.pending')
    })
})
