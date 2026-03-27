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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    transformTransactionItem,
    transformTransactionHistoryResponse,
} from '../transformers'
import type { TransactionHistoryItemApiResponse } from '../schema'

const makeApiItem = (
    overrides: Partial<TransactionHistoryItemApiResponse> = {},
): TransactionHistoryItemApiResponse => ({
    id: 'TX123',
    tx_type: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    confirmed_round: 12345,
    round_time: 1700000000,
    fee: '1000',
    swap_group_detail: null,
    interpreted_meaning: null,
    group_id: null,
    amount: '5000000',
    close_to: null,
    asset: null,
    application_id: null,
    inner_transaction_count: null,
    ...overrides,
})

describe('transformTransactionItem', () => {
    it('transforms a basic payment transaction', () => {
        const apiItem = makeApiItem()
        const result = transformTransactionItem(apiItem)

        expect(result).toEqual({
            id: 'TX123',
            txType: 'pay',
            sender: 'SENDER_ADDR',
            receiver: 'RECEIVER_ADDR',
            confirmedRound: 12345,
            roundTime: 1700000000,
            fee: new Decimal(1000),
            swapGroupDetail: null,
            interpretedMeaning: null,
            groupId: null,
            amount: new Decimal(5000000),
            closeTo: null,
            asset: null,
            applicationId: null,
            innerTransactionCount: null,
        })
    })

    it('converts string numeric fields to numbers', () => {
        const apiItem = makeApiItem({
            confirmed_round: '99999' as unknown as number,
            round_time: '1700000001' as unknown as number,
        })
        const result = transformTransactionItem(apiItem)

        expect(result.confirmedRound).toBe(99999)
        expect(result.roundTime).toBe(1700000001)
    })

    it('maps receiver to null when absent', () => {
        const apiItem = makeApiItem({ receiver: undefined })
        const result = transformTransactionItem(apiItem)

        expect(result.receiver).toBeNull()
    })

    it('transforms swap group detail when present', () => {
        const apiItem = makeApiItem({
            swap_group_detail: {
                asset_in_id: 31566704,
                asset_in_unit_name: 'USDC',
                asset_out_id: 0,
                asset_out_unit_name: 'ALGO',
                amount_in: '1000000',
                amount_out: '5000000',
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.swapGroupDetail).toEqual({
            assetInId: 31566704,
            assetInUnitName: 'USDC',
            assetOutId: 0,
            assetOutUnitName: 'ALGO',
            amountIn: '1000000',
            amountOut: '5000000',
        })
    })

    it('handles swap group detail with missing optional fields', () => {
        const apiItem = makeApiItem({
            swap_group_detail: {
                asset_in_id: undefined,
                asset_in_unit_name: undefined,
                asset_out_id: undefined,
                asset_out_unit_name: undefined,
                amount_in: undefined,
                amount_out: undefined,
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.swapGroupDetail).toEqual({
            assetInId: null,
            assetInUnitName: '',
            assetOutId: null,
            assetOutUnitName: '',
            amountIn: '0',
            amountOut: '0',
        })
    })

    it('transforms asset summary when present', () => {
        const apiItem = makeApiItem({
            asset: {
                asset_id: 31566704,
                name: 'USD Coin',
                unit_name: 'USDC',
                decimals: 6,
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.asset).toEqual({
            assetId: 31566704,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
        })
    })

    it('handles asset summary with missing optional fields', () => {
        const apiItem = makeApiItem({
            asset: {
                asset_id: 123,
                name: undefined,
                unit_name: undefined,
                decimals: undefined,
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.asset).toEqual({
            assetId: 123,
            name: '',
            unitName: '',
            decimals: 0,
        })
    })

    it('transforms interpreted meaning when present', () => {
        const apiItem = makeApiItem({
            interpreted_meaning: {
                title: 'Received ALGO',
                description: 'You received 5 ALGO from SENDER',
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.interpretedMeaning).toEqual({
            title: 'Received ALGO',
            description: 'You received 5 ALGO from SENDER',
        })
    })

    it('handles interpreted meaning with missing optional fields', () => {
        const apiItem = makeApiItem({
            interpreted_meaning: {
                title: undefined,
                description: undefined,
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.interpretedMeaning).toEqual({
            title: '',
            description: '',
        })
    })

    it('converts application_id to string when present', () => {
        const apiItem = makeApiItem({ application_id: 12345 })
        const result = transformTransactionItem(apiItem)

        expect(result.applicationId).toBe('12345')
    })

    it('converts inner_transaction_count to number when present', () => {
        const apiItem = makeApiItem({ inner_transaction_count: 3 })
        const result = transformTransactionItem(apiItem)

        expect(result.innerTransactionCount).toBe(3)
    })

    it('preserves groupId and closeTo when present', () => {
        const apiItem = makeApiItem({
            group_id: 'GROUP_ABC',
            close_to: 'CLOSE_ADDR',
        })
        const result = transformTransactionItem(apiItem)

        expect(result.groupId).toBe('GROUP_ABC')
        expect(result.closeTo).toBe('CLOSE_ADDR')
    })
})

describe('transformTransactionHistoryResponse', () => {
    it('transforms a full API response with transactions', () => {
        const apiResponse = {
            current_round: 40000000,
            next: 'https://api.example.com/next?cursor=abc',
            previous: 'https://api.example.com/prev?cursor=xyz',
            results: [makeApiItem({ id: 'TX1' }), makeApiItem({ id: 'TX2' })],
        }

        const result = transformTransactionHistoryResponse(apiResponse)

        expect(result.transactions).toHaveLength(2)
        expect(result.transactions[0].id).toBe('TX1')
        expect(result.transactions[1].id).toBe('TX2')
        expect(result.pagination).toEqual({
            hasNextPage: true,
            hasPreviousPage: true,
            nextUrl: 'https://api.example.com/next?cursor=abc',
            previousUrl: 'https://api.example.com/prev?cursor=xyz',
            totalFetched: 2,
        })
        expect(result.currentRound).toBe(40000000)
    })

    it('handles empty results', () => {
        const apiResponse = {
            current_round: 40000000,
            next: null,
            previous: null,
            results: [],
        }

        const result = transformTransactionHistoryResponse(apiResponse)

        expect(result.transactions).toEqual([])
        expect(result.pagination.hasNextPage).toBe(false)
        expect(result.pagination.hasPreviousPage).toBe(false)
        expect(result.pagination.totalFetched).toBe(0)
    })

    it('sets hasNextPage false when next is null', () => {
        const apiResponse = {
            current_round: 1,
            next: null,
            previous: 'https://api.example.com/prev',
            results: [makeApiItem()],
        }

        const result = transformTransactionHistoryResponse(apiResponse)

        expect(result.pagination.hasNextPage).toBe(false)
        expect(result.pagination.hasPreviousPage).toBe(true)
    })

    it('defaults currentRound to 0 when missing', () => {
        const apiResponse = {
            current_round: undefined,
            next: null,
            previous: null,
            results: [],
        }

        const result = transformTransactionHistoryResponse(apiResponse)

        expect(result.currentRound).toBe(0)
    })

    it('converts string current_round to number', () => {
        const apiResponse = {
            current_round: '40000001' as unknown as number,
            next: null,
            previous: null,
            results: [],
        }

        const result = transformTransactionHistoryResponse(apiResponse)

        expect(result.currentRound).toBe(40000001)
    })
})
