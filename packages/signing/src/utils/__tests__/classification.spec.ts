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
    type GroupTransactionItem,
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

    test('stamps groupIndex and defaults isExternal to false when no signable set provided', () => {
        const tx = createTx('tx1')
        const items = createTransactionListItems([tx])
        expect(items).toHaveLength(1)
        expect(items[0]).toEqual({
            type: 'transaction',
            transaction: tx,
            groupIndex: 0,
            isExternal: false,
        })
    })

    test('marks indices outside signableIndices as external', () => {
        const tx0 = createTx('tx0')
        const tx1 = createTx('tx1')
        const tx2 = createTx('tx2')
        const items = createTransactionListItems(
            [tx0, tx1, tx2],
            new Set([0, 2]),
        )
        expect(items).toEqual([
            {
                type: 'transaction',
                transaction: tx0,
                groupIndex: 0,
                isExternal: false,
            },
            {
                type: 'transaction',
                transaction: tx1,
                groupIndex: 1,
                isExternal: true,
            },
            {
                type: 'transaction',
                transaction: tx2,
                groupIndex: 2,
                isExternal: false,
            },
        ])
    })

    test('expands single group to individual transactions and stamps groupIndex', () => {
        const group = new Uint8Array([1, 2, 3])
        const tx1 = createTx('tx1', group)
        const tx2 = createTx('tx2', group)
        const tx3 = createTx('tx3', group)

        const items = createTransactionListItems([tx1, tx2, tx3])

        expect(items).toHaveLength(3)
        expect(items[0]).toEqual({
            type: 'transaction',
            transaction: tx1,
            groupIndex: 0,
            isExternal: false,
        })
        expect(items[1]).toEqual({
            type: 'transaction',
            transaction: tx2,
            groupIndex: 1,
            isExternal: false,
        })
        expect(items[2]).toEqual({
            type: 'transaction',
            transaction: tx3,
            groupIndex: 2,
            isExternal: false,
        })
    })

    test('preserves order and groups transactions at position of first member', () => {
        const groupA = new Uint8Array([1, 2, 3])
        const groupB = new Uint8Array([4, 5, 6])
        const tx1 = createTx('tx1', groupA)
        const tx2 = createTx('tx2', groupB)
        const tx3 = createTx('tx3', groupA)
        const tx4 = createTx('tx4', groupB)

        const items = createTransactionListItems([tx1, tx2, tx3, tx4])

        expect(items).toHaveLength(2)
        const groupAItem = items[0] as GroupTransactionItem
        expect(groupAItem.type).toBe('group')
        expect(groupAItem.transactions.map(t => t.transaction.id)).toEqual([
            'tx1',
            'tx3',
        ])
        expect(groupAItem.transactions.map(t => t.groupIndex)).toEqual([0, 2])
        const groupBItem = items[1] as GroupTransactionItem
        expect(groupBItem.transactions.map(t => t.transaction.id)).toEqual([
            'tx2',
            'tx4',
        ])
        expect(groupBItem.transactions.map(t => t.groupIndex)).toEqual([1, 3])
    })

    test('keeps group collapsed when mixed with ungrouped transactions', () => {
        const group = new Uint8Array([1, 2, 3])
        const groupedTx1 = createTx('grouped1', group)
        const groupedTx2 = createTx('grouped2', group)
        const ungroupedTx = createTx('ungrouped')

        const items = createTransactionListItems([
            groupedTx1,
            ungroupedTx,
            groupedTx2,
        ])

        expect(items).toHaveLength(2)
        expect(items[0].type).toBe('group')
        const groupItem = items[0] as GroupTransactionItem
        expect(groupItem.transactions.map(t => t.transaction.id)).toEqual([
            'grouped1',
            'grouped2',
        ])
        expect(groupItem.transactions.map(t => t.groupIndex)).toEqual([0, 2])
        expect(items[1]).toEqual({
            type: 'transaction',
            transaction: ungroupedTx,
            groupIndex: 1,
            isExternal: false,
        })
    })

    test('handles multiple ungrouped transactions', () => {
        const tx1 = createTx('tx1')
        const tx2 = createTx('tx2')
        const tx3 = createTx('tx3')

        const items = createTransactionListItems([tx1, tx2, tx3])

        expect(items).toHaveLength(3)
        items.forEach((item, i) => {
            expect(item).toEqual({
                type: 'transaction',
                transaction: [tx1, tx2, tx3][i],
                groupIndex: i,
                isExternal: false,
            })
        })
    })

    test('marks external indices inside a collapsed group', () => {
        const group = new Uint8Array([1, 2, 3])
        const groupedTx1 = createTx('g1', group)
        const ungroupedTx = createTx('u')
        const groupedTx2 = createTx('g2', group)

        const items = createTransactionListItems(
            [groupedTx1, ungroupedTx, groupedTx2],
            new Set([0]),
        )
        const groupItem = items[0] as GroupTransactionItem
        expect(groupItem.transactions.map(t => t.isExternal)).toEqual([
            false,
            true,
        ])
        const ungroupedItem = items[1]
        expect(ungroupedItem?.type).toBe('transaction')
        if (ungroupedItem?.type === 'transaction') {
            expect(ungroupedItem.isExternal).toBe(true)
        }
    })
})

describe('classifyRequestStructure', () => {
    test('returns single for empty list', () => {
        expect(classifyRequestStructure([])).toBe('single')
    })

    test('returns single for one transaction item', () => {
        expect(
            classifyRequestStructure([
                {
                    type: 'transaction',
                    transaction: createTx('tx1'),
                    groupIndex: 0,
                    isExternal: false,
                },
            ]),
        ).toBe('single')
    })

    test('returns list for multiple transaction items', () => {
        expect(
            classifyRequestStructure([
                {
                    type: 'transaction',
                    transaction: createTx('tx1'),
                    groupIndex: 0,
                    isExternal: false,
                },
                {
                    type: 'transaction',
                    transaction: createTx('tx2'),
                    groupIndex: 1,
                    isExternal: false,
                },
            ]),
        ).toBe('list')
    })

    test('returns list for single group item', () => {
        expect(
            classifyRequestStructure([
                {
                    type: 'group',
                    groupIndex: 0,
                    transactions: [
                        {
                            type: 'transaction',
                            transaction: createTx('a', new Uint8Array([1])),
                            groupIndex: 0,
                            isExternal: false,
                        },
                        {
                            type: 'transaction',
                            transaction: createTx('b', new Uint8Array([1])),
                            groupIndex: 1,
                            isExternal: false,
                        },
                    ],
                },
            ]),
        ).toBe('list')
    })

    test('returns list for mixed items', () => {
        expect(
            classifyRequestStructure([
                {
                    type: 'transaction',
                    transaction: createTx('tx1'),
                    groupIndex: 0,
                    isExternal: false,
                },
                {
                    type: 'group',
                    groupIndex: 1,
                    transactions: [
                        {
                            type: 'transaction',
                            transaction: createTx('a', new Uint8Array([2])),
                            groupIndex: 1,
                            isExternal: false,
                        },
                    ],
                },
            ]),
        ).toBe('list')
    })
})
