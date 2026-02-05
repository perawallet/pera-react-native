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
    classifyTransactionGroups,
    createTransactionListItems,
} from '../classification'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

const tx = {} as PeraDisplayableTransaction
const txWithGroup = {
    group: new Uint8Array([1, 2, 3]),
} as PeraDisplayableTransaction

describe('classifyTransactionGroups', () => {
    test('returns single for empty groups', () => {
        expect(classifyTransactionGroups([])).toBe('single')
    })

    test('returns single for one transaction in one group', () => {
        expect(classifyTransactionGroups([[tx]])).toBe('single')
    })

    test('returns list for multiple transactions in one group', () => {
        expect(classifyTransactionGroups([[tx, tx, tx]])).toBe('list')
    })

    test('returns list for multiple groups', () => {
        expect(classifyTransactionGroups([[tx], [tx, tx]])).toBe('list')
    })
})

describe('createTransactionListItems', () => {
    test('returns empty array for empty groups', () => {
        expect(createTransactionListItems([])).toEqual([])
    })

    test('returns single transaction item for ungrouped transaction', () => {
        const items = createTransactionListItems([[tx]])
        expect(items).toHaveLength(1)
        expect(items[0]).toEqual({
            type: 'transaction',
            transaction: tx,
        })
    })

    test('returns group item for multiple transactions in a group', () => {
        const items = createTransactionListItems([[tx, tx, tx]])
        expect(items).toHaveLength(1)
        expect(items[0]).toEqual({
            type: 'group',
            transactions: [tx, tx, tx],
            groupIndex: 0,
        })
    })

    test('returns group item for single transaction with group ID', () => {
        const items = createTransactionListItems([[txWithGroup]])
        expect(items).toHaveLength(1)
        expect(items[0]).toEqual({
            type: 'group',
            transactions: [txWithGroup],
            groupIndex: 0,
        })
    })

    test('returns mixed items for groups and individual transactions', () => {
        const items = createTransactionListItems([
            [tx], // Individual transaction (no group ID)
            [tx, tx], // Group with 2 transactions
            [txWithGroup], // Single tx with group ID -> shown as group
        ])
        expect(items).toHaveLength(3)
        expect(items[0]).toEqual({
            type: 'transaction',
            transaction: tx,
        })
        expect(items[1]).toEqual({
            type: 'group',
            transactions: [tx, tx],
            groupIndex: 1,
        })
        expect(items[2]).toEqual({
            type: 'group',
            transactions: [txWithGroup],
            groupIndex: 2,
        })
    })
})
