/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi } from 'vitest'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatISODate: (date: Date) => date.toISOString().split('T')[0],
        parseRoundTime: (seconds: number) => new Date(seconds * 1000),
    }
})

import {
    buildTransactionListRows,
    getTransactionRowKey,
    getTransactionRowType,
} from '../transactionListRows'

// 2024-01-01T00:00:00Z and 2024-01-02T00:00:00Z in seconds.
const JAN_1 = 1_704_067_200
const JAN_2 = 1_704_153_600

const makeTransaction = (id: string, roundTime: number) =>
    ({ id, roundTime }) as TransactionHistoryItem

describe('buildTransactionListRows', () => {
    it('emits a header before each date group', () => {
        const rows = buildTransactionListRows([
            makeTransaction('1', JAN_1),
            makeTransaction('2', JAN_2),
        ])

        expect(rows.map(row => row.kind)).toEqual([
            'header',
            'transaction',
            'header',
            'transaction',
        ])
    })

    it('orders date groups newest first', () => {
        const rows = buildTransactionListRows([
            makeTransaction('1', JAN_1),
            makeTransaction('2', JAN_2),
        ])

        expect(rows[0].key).toBe('2024-01-02')
        expect(rows[2].key).toBe('2024-01-01')
    })

    it('keeps transactions from the same day under one header, in order', () => {
        const rows = buildTransactionListRows([
            makeTransaction('1', JAN_1),
            makeTransaction('2', JAN_1 + 60),
            makeTransaction('3', JAN_1 + 120),
        ])

        expect(rows.filter(row => row.kind === 'header')).toHaveLength(1)
        expect(
            rows.filter(row => row.kind === 'transaction').map(row => row.key),
        ).toEqual(['1', '2', '3'])
    })

    it('groups same-day transactions that arrive interleaved with another day', () => {
        const rows = buildTransactionListRows([
            makeTransaction('1', JAN_2),
            makeTransaction('2', JAN_1),
            makeTransaction('3', JAN_2 + 60),
        ])

        expect(rows.map(row => row.key)).toEqual([
            '2024-01-02',
            '1',
            '3',
            '2024-01-01',
            '2',
        ])
    })

    it('returns no rows for an empty history', () => {
        expect(buildTransactionListRows([])).toEqual([])
    })
})

describe('row identity', () => {
    it('pools headers and transactions separately', () => {
        const rows = buildTransactionListRows([makeTransaction('1', JAN_1)])

        expect(getTransactionRowType(rows[0])).not.toBe(
            getTransactionRowType(rows[1]),
        )
    })

    it('namespaces keys so a header and a transaction can never collide', () => {
        const rows = buildTransactionListRows([
            makeTransaction('2024-01-01', JAN_1),
        ])

        expect(getTransactionRowKey(rows[0])).not.toBe(
            getTransactionRowKey(rows[1]),
        )
    })
})
