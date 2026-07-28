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

import { describe, test, expect } from 'vitest'
import { transformIndexerTransactions, collectAssetIds } from '../transformers'

const ME = 'AAAA'

const response = {
    'current-round': 4242,
    'next-token': 'cursor-2',
    transactions: [
        {
            id: 'TX1',
            'tx-type': 'pay',
            sender: ME,
            fee: 1000,
            'confirmed-round': 100,
            'round-time': 1700000000,
            group: 'GRP',
            'payment-transaction': { amount: 5000, receiver: 'BBBB' },
        },
        {
            id: 'TX2',
            'tx-type': 'axfer',
            sender: 'BBBB',
            fee: 1000,
            'confirmed-round': 101,
            'round-time': 1700000100,
            'asset-transfer-transaction': {
                'asset-id': 31566704,
                amount: 250000,
                receiver: ME,
            },
        },
    ],
}

describe('transformIndexerTransactions', () => {
    test('maps the pagination envelope onto the pera shape', () => {
        const result = transformIndexerTransactions(response, ME, new Map())

        expect(result.current_round).toBe(4242)
        expect(result.next).toBe('cursor-2')
        expect(result.previous).toBeNull()
        expect(result.results).toHaveLength(2)
    })

    test('maps an absent next-token (tail of pagination) to a null next', () => {
        // Verified against the live fnet indexer: at the true end of
        // pagination the `next-token` key is omitted entirely, never sent as
        // `null`. Getting this wrong (e.g. expecting a literal null) would
        // make the "more pages?" check never terminate or never start.
        const { 'next-token': _drop, ...tail } = response
        const result = transformIndexerTransactions(tail, ME, new Map())

        expect(result.next).toBeNull()
    })

    test('maps common fields and the payment receiver/amount', () => {
        const [first] = transformIndexerTransactions(
            response,
            ME,
            new Map(),
        ).results

        expect(first).toMatchObject({
            id: 'TX1',
            tx_type: 'pay',
            sender: ME,
            receiver: 'BBBB',
            confirmed_round: 100,
            round_time: 1700000000,
            group_id: 'GRP',
            fee: '1000',
            amount: '5000',
        })
    })

    test('attaches computed balance impacts', () => {
        const [first] = transformIndexerTransactions(
            response,
            ME,
            new Map(),
        ).results

        expect(first.balance_impacts).toEqual([
            {
                asset_id: '0',
                unit_name: 'ALGO',
                fraction_decimals: 6,
                amount: '-6000',
            },
        ])
    })

    test('enriches asset entries from the lookup', () => {
        const lookup = new Map([
            ['31566704', { unitName: 'USDC', decimals: 6, name: 'USDC' }],
        ])
        const [, second] = transformIndexerTransactions(
            response,
            ME,
            lookup,
        ).results

        expect(second.asset).toEqual({
            asset_id: '31566704',
            name: 'USDC',
            unit_name: 'USDC',
            decimals: 6,
        })
        expect(second.balance_impacts).toEqual([
            {
                asset_id: '31566704',
                unit_name: 'USDC',
                fraction_decimals: 6,
                amount: '250000',
            },
        ])
    })

    test('attributes a clawback debit to the account actually drained, not the clawback authority', () => {
        // Regression coverage for a real bug caught earlier in this feature:
        // the effective sender during a clawback is the NESTED `sender` on
        // `asset-transfer-transaction` (asnd) — there is no top-level
        // `asset-sender` field. If the schema ever stopped accepting/passing
        // through that nested field, this row would wrongly attribute the
        // debit to CLAWBACK_ADMIN (the enclosing transaction's own top-level
        // sender) instead of DRAINED.
        const clawback = {
            'current-round': 1,
            transactions: [
                {
                    id: 'CLAWTX',
                    'tx-type': 'axfer',
                    sender: 'CLAWBACK_ADMIN',
                    fee: 1000,
                    'confirmed-round': 200,
                    'round-time': 1700000200,
                    'asset-transfer-transaction': {
                        'asset-id': 7,
                        amount: 500,
                        receiver: 'RECEIVER',
                        sender: 'DRAINED',
                    },
                },
            ],
        }

        const [row] = transformIndexerTransactions(
            clawback,
            'DRAINED',
            new Map(),
        ).results

        expect(row.balance_impacts).toEqual([
            {
                asset_id: '7',
                unit_name: '',
                fraction_decimals: 0,
                amount: '-500',
            },
        ])
    })

    test('preserves precision for an amount above 2^53 arriving as a string', () => {
        // parsePrecisionSafeJson surfaces uint64 values above 2^53-1 as
        // decimal strings rather than rounding them — real fnet assets have
        // a total supply around 1e16. Routing this through Number() would
        // silently corrupt it. This value (2^64-1, odd) is not just "large" —
        // it is specifically NOT exactly representable as a float64 (unlike
        // some large-but-round values, which can survive Number() by
        // coincidence and would not discriminate this test).
        const LARGE_AMOUNT = '18446744073709551615'
        const bigTx = {
            'current-round': 1,
            transactions: [
                {
                    id: 'BIGTX',
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 1000,
                    'confirmed-round': 300,
                    'round-time': 1700000300,
                    'asset-transfer-transaction': {
                        'asset-id': 123,
                        amount: LARGE_AMOUNT,
                        receiver: 'BBBB',
                    },
                },
            ],
        }

        const [row] = transformIndexerTransactions(bigTx, ME, new Map()).results

        expect(row.amount).toBe(LARGE_AMOUNT)
        expect(row.balance_impacts).toEqual([
            {
                asset_id: '0',
                unit_name: 'ALGO',
                fraction_decimals: 6,
                amount: '-1000',
            },
            {
                asset_id: '123',
                unit_name: '',
                fraction_decimals: 0,
                amount: `-${LARGE_AMOUNT}`,
            },
        ])
    })

    test('omits pera-only interpretive fields', () => {
        const [first] = transformIndexerTransactions(
            response,
            ME,
            new Map(),
        ).results

        expect(first.swap_group_detail).toBeUndefined()
        expect(first.interpreted_meaning).toBeUndefined()
    })

    test('drops a single unparseable row without failing the page', () => {
        const badRow = {
            id: 'BAD',
            'tx-type': 'pay',
            // Missing required `sender` — this row cannot be mapped.
            fee: 1000,
            'payment-transaction': { amount: 5000, receiver: 'BBBB' },
        }
        const mixed = {
            ...response,
            transactions: [response.transactions[0], badRow],
        }

        const result = transformIndexerTransactions(mixed, ME, new Map())

        expect(result.results).toHaveLength(1)
        expect(result.results[0]?.id).toBe('TX1')
    })
})

describe('collectAssetIds', () => {
    test('collects distinct asset ids across top-level and inner transactions, ignoring ALGO', () => {
        const withInner = {
            transactions: [
                {
                    id: 'OUTER',
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 1000,
                    'asset-transfer-transaction': {
                        'asset-id': 5,
                        amount: 1,
                        receiver: 'BBBB',
                    },
                    'inner-txns': [
                        {
                            id: 'INNER1',
                            'tx-type': 'axfer',
                            sender: ME,
                            fee: 0,
                            'asset-transfer-transaction': {
                                'asset-id': 5,
                                amount: 1,
                                receiver: 'BBBB',
                            },
                        },
                        {
                            id: 'INNER2',
                            'tx-type': 'pay',
                            sender: ME,
                            fee: 0,
                            'payment-transaction': {
                                amount: 1,
                                receiver: 'BBBB',
                            },
                        },
                    ],
                },
            ],
        }

        expect(collectAssetIds(withInner)).toEqual(['5'])
    })

    test('returns no ids for a page with only payment transactions', () => {
        const paymentOnly = {
            transactions: [response.transactions[0]],
        }

        expect(collectAssetIds(paymentOnly)).toEqual([])
    })
})
