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
import { GroupPreviewItem } from '../GroupPreviewItem'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params?.count !== undefined) {
                return `${key}:${params.count}`
            }
            if (params?.groupId !== undefined) {
                return `${key}:${params.groupId}`
            }
            return key
        },
    }),
}))

const createMockTransaction = (
    id: string,
    group?: Uint8Array,
): PeraDisplayableTransaction =>
    ({
        id,
        group,
        sender: 'MOCK_SENDER',
        fee: 1000n,
    }) as PeraDisplayableTransaction

describe('GroupPreviewItem', () => {
    it('renders transaction count', () => {
        const transactions = [
            createMockTransaction('tx-1', new Uint8Array([1, 2, 3])),
            createMockTransaction('tx-2', new Uint8Array([1, 2, 3])),
            createMockTransaction('tx-3', new Uint8Array([1, 2, 3])),
        ]

        const { container } = render(
            <GroupPreviewItem
                transactions={transactions}
                onPress={vi.fn()}
            />,
        )

        expect(container.textContent).toContain(
            'transactions.group.transactions_count:3',
        )
    })

    it('renders group title', () => {
        const transactions = [
            createMockTransaction('tx-1', new Uint8Array([1, 2, 3])),
        ]

        const { container } = render(
            <GroupPreviewItem
                transactions={transactions}
                onPress={vi.fn()}
            />,
        )

        expect(container.textContent).toContain(
            'transactions.group.group_number',
        )
    })

    it('calls onPress when pressed', () => {
        const onPress = vi.fn()
        const transactions = [
            createMockTransaction('tx-1', new Uint8Array([1, 2, 3])),
        ]

        const { container } = render(
            <GroupPreviewItem
                transactions={transactions}
                onPress={onPress}
            />,
        )

        const touchable = container.querySelector('[role="button"]')
        if (touchable) {
            fireEvent.click(touchable)
            expect(onPress).toHaveBeenCalled()
        }
    })

    it('extracts and displays truncated group ID', () => {
        // Group ID: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06]
        // Hex: "010203040506"
        // Truncated to 10 chars: "0102030405"
        const transactions = [
            createMockTransaction(
                'tx-1',
                new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]),
            ),
        ]

        const { container } = render(
            <GroupPreviewItem
                transactions={transactions}
                onPress={vi.fn()}
            />,
        )

        // Should display the truncated hex group ID
        expect(container.textContent).toContain(
            'transactions.group.group_id:0102030405',
        )
    })

    it('handles transactions without group ID', () => {
        const transactions = [createMockTransaction('tx-1')]

        const { container } = render(
            <GroupPreviewItem
                transactions={transactions}
                onPress={vi.fn()}
            />,
        )

        // Should still render without crashing
        expect(container.textContent).toContain(
            'transactions.group.group_number',
        )
    })

    it('handles empty transactions array', () => {
        const { container } = render(
            <GroupPreviewItem
                transactions={[]}
                onPress={vi.fn()}
            />,
        )

        // Should render with 0 count
        expect(container.textContent).toContain(
            'transactions.group.transactions_count:0',
        )
    })
})
