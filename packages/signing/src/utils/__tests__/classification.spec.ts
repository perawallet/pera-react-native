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

import { describe, test, expect } from 'vitest'
import {
    classifyRequestStructure,
    createTransactionListItems,
} from '../classification'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

const createTx = (id: string, group?: Uint8Array): PeraDisplayableTransaction =>
    ({
        id,
        group,
    }) as PeraDisplayableTransaction

describe('createTransactionListItems', () => {
    test('returns empty array for empty transactions', () => {
        expect(createTransactionListItems([])).toEqual([])
    })

    test('returns single transaction item for ungrouped transaction', () => {
        const tx = createTx('tx1')
        const items = createTransactionListItems([tx])
        expect(items).toHaveLength(1)
        expect(items[0]).toEqual({
            type: 'transaction',
            transaction: tx,
        })
    })

    test('expands single group to individual transactions', () => {
        const group = new Uint8Array([1, 2, 3])
        const tx1 = createTx('tx1', group)
        const tx2 = createTx('tx2', group)
        const tx3 = createTx('tx3', group)

        const items = createTransactionListItems([tx1, tx2, tx3])

        // Single group should be expanded
        expect(items).toHaveLength(3)
        expect(items[0]).toEqual({ type: 'transaction', transaction: tx1 })
        expect(items[1]).toEqual({ type: 'transaction', transaction: tx2 })
        expect(items[2]).toEqual({ type: 'transaction', transaction: tx3 })
    })

    test('preserves order and groups transactions at position of first member', () => {
        const groupA = new Uint8Array([1, 2, 3])
        const groupB = new Uint8Array([4, 5, 6])

        const tx1 = createTx('tx1', groupA) // Group A starts here
        const tx2 = createTx('tx2') // Ungrouped
        const tx3 = createTx('tx3', groupB) // Group B starts here
        const tx4 = createTx('tx4', groupA) // Added to Group A
        const tx5 = createTx('tx5', groupB) // Added to Group B

        const items = createTransactionListItems([tx1, tx2, tx3, tx4, tx5])

        expect(items).toHaveLength(3)

        // First item: Group A (at position of tx1)
        expect(items[0]).toEqual({
            type: 'group',
            transactions: [tx1, tx4],
            groupIndex: 0,
        })

        // Second item: Ungrouped tx2
        expect(items[1]).toEqual({
            type: 'transaction',
            transaction: tx2,
        })

        // Third item: Group B (at position of tx3)
        expect(items[2]).toEqual({
            type: 'group',
            transactions: [tx3, tx5],
            groupIndex: 1,
        })
    })

    test('keeps group collapsed when mixed with ungrouped transactions', () => {
        const group = new Uint8Array([1, 2, 3])
        const tx1 = createTx('tx1', group)
        const tx2 = createTx('tx2') // Ungrouped
        const tx3 = createTx('tx3', group)

        const items = createTransactionListItems([tx1, tx2, tx3])

        expect(items).toHaveLength(2)
        expect(items[0]).toEqual({
            type: 'group',
            transactions: [tx1, tx3],
            groupIndex: 0,
        })
        expect(items[1]).toEqual({
            type: 'transaction',
            transaction: tx2,
        })
    })

    test('handles multiple ungrouped transactions', () => {
        const tx1 = createTx('tx1')
        const tx2 = createTx('tx2')
        const tx3 = createTx('tx3')

        const items = createTransactionListItems([tx1, tx2, tx3])

        expect(items).toHaveLength(3)
        expect(items[0]).toEqual({ type: 'transaction', transaction: tx1 })
        expect(items[1]).toEqual({ type: 'transaction', transaction: tx2 })
        expect(items[2]).toEqual({ type: 'transaction', transaction: tx3 })
    })
})

describe('classifyRequestStructure', () => {
    test('returns single for empty list', () => {
        expect(classifyRequestStructure([])).toBe('single')
    })

    test('returns single for one transaction item', () => {
        const tx = createTx('tx1')
        expect(
            classifyRequestStructure([
                { type: 'transaction', transaction: tx },
            ]),
        ).toBe('single')
    })

    test('returns list for multiple transaction items', () => {
        const tx1 = createTx('tx1')
        const tx2 = createTx('tx2')
        expect(
            classifyRequestStructure([
                { type: 'transaction', transaction: tx1 },
                { type: 'transaction', transaction: tx2 },
            ]),
        ).toBe('list')
    })

    test('returns list for single group item', () => {
        const tx = createTx('tx1')
        expect(
            classifyRequestStructure([
                { type: 'group', transactions: [tx], groupIndex: 0 },
            ]),
        ).toBe('list')
    })

    test('returns list for mixed items', () => {
        const tx1 = createTx('tx1')
        const tx2 = createTx('tx2')
        expect(
            classifyRequestStructure([
                { type: 'group', transactions: [tx1], groupIndex: 0 },
                { type: 'transaction', transaction: tx2 },
            ]),
        ).toBe('list')
    })
})
