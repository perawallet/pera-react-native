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
import { logger } from '@perawallet/wallet-core-shared'
import {
    parseTransactionHistoryResponse,
    transactionHistoryItemResponseSchema,
    transactionHistoryResponseSchema,
    transactionSwapGroupDetailSchema,
    transactionAssetSummarySchema,
    transactionInterpretedMeaningSchema,
} from '../schema'

const makeValidItem = (overrides: Record<string, unknown> = {}) => ({
    id: 'TX123',
    tx_type: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    confirmed_round: 12345,
    round_time: 1700000000,
    fee: '1000',
    ...overrides,
})

describe('transactionSwapGroupDetailSchema', () => {
    it('parses a complete swap detail', () => {
        const input = {
            asset_in_id: 31566704,
            asset_in_unit_name: 'USDC',
            asset_out_id: 0,
            asset_out_unit_name: 'ALGO',
            amount_in: '1000000',
            amount_out: '5000000',
        }

        const result = transactionSwapGroupDetailSchema.parse(input)

        expect(result.asset_in_id).toBe('31566704')
        expect(result.asset_in_unit_name).toBe('USDC')
        expect(result.asset_out_id).toBe('0')
        expect(result.amount_in).toBe('1000000')
    })

    it('normalizes asset IDs to decimal strings', () => {
        const input = {
            asset_in_id: '31566704',
            asset_out_id: '0',
        }

        const result = transactionSwapGroupDetailSchema.parse(input)

        expect(result.asset_in_id).toBe('31566704')
        expect(result.asset_out_id).toBe('0')
    })

    it('preserves asset IDs above 2^53 without precision loss', () => {
        const bigId = '18446744073709551615' // 2^64 - 1
        const result = transactionSwapGroupDetailSchema.parse({
            asset_in_id: bigId,
        })

        expect(result.asset_in_id).toBe(bigId)
    })

    it('applies defaults for missing optional fields', () => {
        const result = transactionSwapGroupDetailSchema.parse({})

        expect(result.asset_in_unit_name).toBe('')
        expect(result.asset_out_unit_name).toBe('')
        expect(result.amount_in).toBe('0')
        expect(result.amount_out).toBe('0')
    })
})

describe('transactionAssetSummarySchema', () => {
    it('parses a complete asset summary', () => {
        const input = {
            asset_id: 31566704,
            name: 'USD Coin',
            unit_name: 'USDC',
            decimals: 6,
        }

        const result = transactionAssetSummarySchema.parse(input)

        expect(result.asset_id).toBe('31566704')
        expect(result.name).toBe('USD Coin')
        expect(result.unit_name).toBe('USDC')
        expect(result.decimals).toBe(6)
    })

    it('normalizes asset_id to a decimal string', () => {
        const input = { asset_id: '31566704' }

        const result = transactionAssetSummarySchema.parse(input)

        expect(result.asset_id).toBe('31566704')
    })

    it('preserves an asset_id above 2^53 without precision loss', () => {
        const bigId = '18446744073709551615' // 2^64 - 1
        const result = transactionAssetSummarySchema.parse({
            asset_id: bigId,
        })

        expect(result.asset_id).toBe(bigId)
    })

    it('applies defaults for missing optional fields', () => {
        const input = { asset_id: 123 }

        const result = transactionAssetSummarySchema.parse(input)

        expect(result.name).toBe('')
        expect(result.unit_name).toBe('')
        expect(result.decimals).toBe(0)
    })

    it('rejects missing required asset_id', () => {
        expect(() => transactionAssetSummarySchema.parse({})).toThrow()
    })
})

describe('transactionInterpretedMeaningSchema', () => {
    it('parses a complete interpreted meaning', () => {
        const input = {
            title: 'Received ALGO',
            description: 'You received 5 ALGO',
        }

        const result = transactionInterpretedMeaningSchema.parse(input)

        expect(result.title).toBe('Received ALGO')
        expect(result.description).toBe('You received 5 ALGO')
    })

    it('applies defaults for missing optional fields', () => {
        const result = transactionInterpretedMeaningSchema.parse({})

        expect(result.title).toBe('')
        expect(result.description).toBe('')
    })
})

describe('transactionHistoryItemResponseSchema', () => {
    it('parses a valid minimal transaction item', () => {
        const result =
            transactionHistoryItemResponseSchema.parse(makeValidItem())

        expect(result.id).toBe('TX123')
        expect(result.tx_type).toBe('pay')
        expect(result.sender).toBe('SENDER_ADDR')
        expect(result.receiver).toBe('RECEIVER_ADDR')
        expect(result.confirmed_round).toBe(12345)
        expect(result.round_time).toBe(1700000000)
        expect(result.fee).toBe('1000')
    })

    it('accepts all valid transaction types', () => {
        const txTypes = [
            'pay',
            'axfer',
            'acfg',
            'afrz',
            'appl',
            'keyreg',
            'hb',
            'stpf',
        ]

        for (const txType of txTypes) {
            const result = transactionHistoryItemResponseSchema.parse(
                makeValidItem({ tx_type: txType }),
            )
            expect(result.tx_type).toBe(txType)
        }
    })

    // Not laxness for its own sake: the renderers all have a `default:` branch,
    // so an unmodeled type shows as a generic transaction. Rejecting it here
    // would hide the row entirely.
    it('accepts a transaction type the app does not model yet', () => {
        const result = transactionHistoryItemResponseSchema.parse(
            makeValidItem({ tx_type: 'somefuturetype' }),
        )

        expect(result.tx_type).toBe('somefuturetype')
    })

    it('rejects a non-string transaction type', () => {
        expect(() =>
            transactionHistoryItemResponseSchema.parse(
                makeValidItem({ tx_type: 7 }),
            ),
        ).toThrow()
    })

    it('coerces string numeric fields to numbers', () => {
        const result = transactionHistoryItemResponseSchema.parse(
            makeValidItem({
                confirmed_round: '99999',
                round_time: '1700000001',
            }),
        )

        expect(result.confirmed_round).toBe(99999)
        expect(result.round_time).toBe(1700000001)
    })

    it('accepts nullable optional fields', () => {
        const result = transactionHistoryItemResponseSchema.parse(
            makeValidItem({
                receiver: null,
                group_id: null,
                amount: null,
                close_to: null,
                asset: null,
                application_id: null,
                inner_transaction_count: null,
                swap_group_detail: null,
                interpreted_meaning: null,
            }),
        )

        expect(result.receiver).toBeNull()
        expect(result.group_id).toBeNull()
        expect(result.asset).toBeNull()
    })

    it('rejects missing required fields', () => {
        expect(() =>
            transactionHistoryItemResponseSchema.parse({ id: 'TX1' }),
        ).toThrow()

        expect(() =>
            transactionHistoryItemResponseSchema.parse({
                tx_type: 'pay',
                sender: 'ADDR',
            }),
        ).toThrow()
    })

    it('normalizes application_id to a decimal string', () => {
        const result = transactionHistoryItemResponseSchema.parse(
            makeValidItem({ application_id: 456 }),
        )

        expect(result.application_id).toBe('456')
    })

    it('coerces string inner_transaction_count to number', () => {
        const result = transactionHistoryItemResponseSchema.parse(
            makeValidItem({ inner_transaction_count: '3' }),
        )

        expect(result.inner_transaction_count).toBe(3)
    })
})

describe('transactionHistoryResponseSchema', () => {
    it('parses a valid response with results', () => {
        const input = {
            current_round: 40000000,
            next: 'https://api.example.com/next',
            previous: 'https://api.example.com/prev',
            results: [makeValidItem()],
        }

        const result = transactionHistoryResponseSchema.parse(input)

        expect(result.current_round).toBe(40000000)
        expect(result.next).toBe('https://api.example.com/next')
        expect(result.previous).toBe('https://api.example.com/prev')
        expect(result.results).toHaveLength(1)
    })

    it('parses an empty results array', () => {
        const input = {
            current_round: 1,
            next: null,
            previous: null,
            results: [],
        }

        const result = transactionHistoryResponseSchema.parse(input)

        expect(result.results).toEqual([])
    })

    it('defaults current_round to 0 when missing', () => {
        const input = {
            results: [],
        }

        const result = transactionHistoryResponseSchema.parse(input)

        expect(result.current_round).toBe(0)
    })

    it('coerces string current_round to number', () => {
        const input = {
            current_round: '40000001',
            results: [],
        }

        const result = transactionHistoryResponseSchema.parse(input)

        expect(result.current_round).toBe(40000001)
    })

    it('rejects missing results array', () => {
        expect(() =>
            transactionHistoryResponseSchema.parse({ current_round: 1 }),
        ).toThrow()
    })

    it('rejects invalid items inside results', () => {
        expect(() =>
            transactionHistoryResponseSchema.parse({
                results: [{ invalid: true }],
            }),
        ).toThrow()
    })
})

describe('parseTransactionHistoryResponse', () => {
    it('keeps the good rows when one row is unparseable', () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

        const result = parseTransactionHistoryResponse({
            current_round: '40000000',
            next: 'https://api.example.com/next',
            results: [
                makeValidItem({ id: 'TX1' }),
                { id: 'TX2', tx_type: 'pay' },
                makeValidItem({ id: 'TX3' }),
            ],
        })

        expect(result.results.map(item => item.id)).toEqual(['TX1', 'TX3'])
        expect(result.current_round).toBe(40000000)
        expect(result.next).toBe('https://api.example.com/next')
        expect(warn).toHaveBeenCalledWith(
            'Dropping unparseable transaction history row',
            expect.objectContaining({ id: 'TX2' }),
        )

        warn.mockRestore()
    })

    it('keeps a row whose type the app does not model', () => {
        const result = parseTransactionHistoryResponse({
            results: [makeValidItem({ id: 'TX_STPF', tx_type: 'stpf' })],
        })

        expect(result.results).toHaveLength(1)
        expect(result.results[0].tx_type).toBe('stpf')
    })

    it('throws on a malformed envelope', () => {
        expect(() =>
            parseTransactionHistoryResponse({ current_round: 1 }),
        ).toThrow()
    })
})
