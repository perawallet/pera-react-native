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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    transformTransactionItem,
    transformTransactionHistoryResponse,
} from '../transformers'
import {
    parseTransactionHistoryResponse,
    type TransactionHistoryItemApiResponse,
} from '../schema'

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
            closeAmount: null,
            asset: null,
            applicationId: null,
            innerTransactionCount: null,
            balanceImpacts: [],
        })
    })

    it('maps close_amount onto closeAmount as a Decimal', () => {
        const apiItem = makeApiItem({
            amount: '0',
            close_to: 'CLOSE_ADDR',
            close_amount: '50854132929',
        })
        const result = transformTransactionItem(apiItem)

        expect(result.closeTo).toBe('CLOSE_ADDR')
        expect(result.closeAmount).toEqual(new Decimal('50854132929'))
    })

    it('maps an absent close_amount to null', () => {
        const result = transformTransactionItem(makeApiItem())

        expect(result.closeAmount).toBeNull()
    })

    describe('closeAmount derivation from balance impacts (backend omits close_amount)', () => {
        it('derives the swept amount for the sender from the ALGO impact minus amount and fee', () => {
            // Sender impact nets amount + close + fee. A real close-out:
            // amount 0, fee 1000, swept 50_854_132_929.
            const apiItem = makeApiItem({
                amount: '0',
                fee: '1000',
                close_to: 'CLOSE_ADDR',
                balance_impacts: [
                    {
                        asset_id: '0',
                        unit_name: 'ALGO',
                        fraction_decimals: 6,
                        amount: '-50854133929',
                    },
                ],
            })

            const result = transformTransactionItem(apiItem, 'SENDER_ADDR')

            expect(result.closeAmount).toEqual(new Decimal('50854132929'))
        })

        it('derives the swept amount for the close-to account from its positive impact', () => {
            const apiItem = makeApiItem({
                sender: 'OTHER_SENDER',
                receiver: 'THIRD_ADDR',
                amount: '1000000',
                close_to: 'ME',
                balance_impacts: [
                    {
                        asset_id: '0',
                        unit_name: 'ALGO',
                        fraction_decimals: 6,
                        amount: '2000000',
                    },
                ],
            })

            const result = transformTransactionItem(apiItem, 'ME')

            expect(result.closeAmount).toEqual(new Decimal('2000000'))
        })

        it('derives the asset opt-out sweep from the asset impact without subtracting the ALGO fee', () => {
            const apiItem = makeApiItem({
                tx_type: 'axfer',
                amount: '0',
                fee: '1000',
                close_to: 'CLOSE_ADDR',
                asset: {
                    asset_id: '31566704',
                    name: 'USD Coin',
                    unit_name: 'USDC',
                    fraction_decimals: 6,
                },
                balance_impacts: [
                    {
                        asset_id: '31566704',
                        unit_name: 'USDC',
                        fraction_decimals: 6,
                        amount: '-250000',
                    },
                    {
                        asset_id: '0',
                        unit_name: 'ALGO',
                        fraction_decimals: 6,
                        amount: '-1000',
                    },
                ],
            })

            const result = transformTransactionItem(apiItem, 'SENDER_ADDR')

            expect(result.closeAmount).toEqual(new Decimal('250000'))
        })

        it('prefers an explicit close_amount over derivation', () => {
            const apiItem = makeApiItem({
                amount: '0',
                close_to: 'CLOSE_ADDR',
                close_amount: '42',
                balance_impacts: [
                    {
                        asset_id: '0',
                        unit_name: 'ALGO',
                        fraction_decimals: 6,
                        amount: '-50854133929',
                    },
                ],
            })

            const result = transformTransactionItem(apiItem, 'SENDER_ADDR')

            expect(result.closeAmount).toEqual(new Decimal('42'))
        })

        it('leaves closeAmount null for a receiver-only perspective', () => {
            const apiItem = makeApiItem({
                sender: 'OTHER_SENDER',
                receiver: 'ME',
                amount: '1000000',
                close_to: 'CLOSE_ADDR',
                balance_impacts: [
                    {
                        asset_id: '0',
                        unit_name: 'ALGO',
                        fraction_decimals: 6,
                        amount: '1000000',
                    },
                ],
            })

            const result = transformTransactionItem(apiItem, 'ME')

            expect(result.closeAmount).toBeNull()
        })

        it('leaves closeAmount null when no account address is provided', () => {
            const apiItem = makeApiItem({
                amount: '0',
                close_to: 'CLOSE_ADDR',
                balance_impacts: [
                    {
                        asset_id: '0',
                        unit_name: 'ALGO',
                        fraction_decimals: 6,
                        amount: '-50854133929',
                    },
                ],
            })

            const result = transformTransactionItem(apiItem)

            expect(result.closeAmount).toBeNull()
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

    it('flattens the nested per-side asset facts of a swap group detail', () => {
        const apiItem = makeApiItem({
            swap_group_detail: {
                asset_in: {
                    asset_id: '31566704',
                    unit_name: 'USDC',
                    fraction_decimals: 6,
                },
                asset_out: {
                    asset_id: '2726252423',
                    unit_name: 'ALPHA',
                    fraction_decimals: 8,
                },
                amount_in: '1000000',
                amount_out: '5000000',
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.swapGroupDetail).toEqual({
            assetInId: '31566704',
            assetInUnitName: 'USDC',
            assetInDecimals: 6,
            assetOutId: '2726252423',
            assetOutUnitName: 'ALPHA',
            assetOutDecimals: 8,
            amountIn: new Decimal('1000000'),
            amountOut: new Decimal('5000000'),
        })
    })

    it('handles swap group detail with missing optional fields', () => {
        const apiItem = makeApiItem({
            swap_group_detail: {
                asset_in: undefined,
                asset_out: undefined,
                amount_in: undefined,
                amount_out: undefined,
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.swapGroupDetail).toEqual({
            assetInId: null,
            assetInUnitName: '',
            assetInDecimals: 6,
            assetOutId: null,
            assetOutUnitName: '',
            assetOutDecimals: 6,
            amountIn: new Decimal('0'),
            amountOut: new Decimal('0'),
        })
    })

    it('transforms asset summary when present', () => {
        const apiItem = makeApiItem({
            asset: {
                asset_id: '31566704',
                name: 'USD Coin',
                unit_name: 'USDC',
                fraction_decimals: 6,
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.asset).toEqual({
            assetId: '31566704',
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
        })
    })

    it('handles asset summary with missing optional fields', () => {
        const apiItem = makeApiItem({
            asset: {
                asset_id: '123',
                name: undefined,
                unit_name: undefined,
                fraction_decimals: undefined,
            },
        })
        const result = transformTransactionItem(apiItem)

        expect(result.asset).toEqual({
            assetId: '123',
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

    it('passes the application_id string through when present', () => {
        const apiItem = makeApiItem({ application_id: '12345' })
        const result = transformTransactionItem(apiItem)

        expect(result.applicationId).toBe('12345')
    })

    it('converts inner_transaction_count to number when present', () => {
        const apiItem = makeApiItem({ inner_transaction_count: 3 })
        const result = transformTransactionItem(apiItem)

        expect(result.innerTransactionCount).toBe(3)
    })

    it('defaults balanceImpacts to an empty array when absent', () => {
        const apiItem = makeApiItem({ balance_impacts: undefined })
        const result = transformTransactionItem(apiItem)

        expect(result.balanceImpacts).toEqual([])
    })

    it('maps balance_impacts to signed Decimal amounts', () => {
        const apiItem = makeApiItem({
            tx_type: 'appl',
            application_id: '12345',
            balance_impacts: [
                {
                    asset_id: '0',
                    unit_name: 'ALGO',
                    fraction_decimals: 6,
                    amount: '-1500000',
                },
                {
                    asset_id: '31566704',
                    unit_name: 'USDC',
                    fraction_decimals: 6,
                    amount: '2000000',
                },
            ],
        })
        const result = transformTransactionItem(apiItem)

        expect(result.balanceImpacts).toEqual([
            {
                assetId: '0',
                unitName: 'ALGO',
                fractionDecimals: 6,
                amount: new Decimal('-1500000'),
            },
            {
                assetId: '31566704',
                unitName: 'USDC',
                fractionDecimals: 6,
                amount: new Decimal('2000000'),
            },
        ])
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

describe('ALGO asset facts', () => {
    // The backend substitutes `asset(<id>)` with 0 decimals whenever its asset
    // enrichment can't resolve an asset. For id 0 the real facts are a chain
    // invariant, so the placeholder is always safe to override.
    const PLACEHOLDER = 'asset(0)'

    it('overrides the placeholder on an ALGO balance impact', () => {
        const apiItem = makeApiItem({
            tx_type: 'appl',
            balance_impacts: [
                {
                    asset_id: '0',
                    unit_name: PLACEHOLDER,
                    fraction_decimals: 0,
                    amount: '-3000',
                },
            ],
        })

        const result = transformTransactionItem(apiItem)

        expect(result.balanceImpacts[0]).toEqual({
            assetId: '0',
            unitName: 'ALGO',
            fractionDecimals: 6,
            amount: new Decimal('-3000'),
        })
    })

    it('leaves a non-ALGO balance impact untouched', () => {
        const apiItem = makeApiItem({
            tx_type: 'appl',
            balance_impacts: [
                {
                    asset_id: '31566704',
                    unit_name: 'asset(31566704)',
                    fraction_decimals: 0,
                    amount: '-3000',
                },
            ],
        })

        const result = transformTransactionItem(apiItem)

        expect(result.balanceImpacts[0]?.unitName).toBe('asset(31566704)')
        expect(result.balanceImpacts[0]?.fractionDecimals).toBe(0)
    })

    it('overrides the placeholder on an ALGO asset summary', () => {
        const apiItem = makeApiItem({
            asset: {
                asset_id: '0',
                name: '',
                unit_name: PLACEHOLDER,
                fraction_decimals: 0,
            },
        })

        const result = transformTransactionItem(apiItem)

        expect(result.asset?.unitName).toBe('ALGO')
        expect(result.asset?.decimals).toBe(6)
    })

    it('overrides the placeholder on the ALGO side of a swap', () => {
        const apiItem = makeApiItem({
            swap_group_detail: {
                asset_in: {
                    asset_id: '0',
                    unit_name: PLACEHOLDER,
                    fraction_decimals: 0,
                },
                asset_out: {
                    asset_id: '2726252423',
                    unit_name: 'ALPHA',
                    fraction_decimals: 6,
                },
                amount_in: '500000',
                amount_out: '6638534',
            },
        })

        const result = transformTransactionItem(apiItem)

        expect(result.swapGroupDetail?.assetInUnitName).toBe('ALGO')
        expect(result.swapGroupDetail?.assetInDecimals).toBe(6)
    })
})

describe('Pera backend wire contract', () => {
    // Verbatim from a mainnet `/v1/accounts/{address}/transactions/` row for a
    // Folks-router swap of 0.5 ALGO into ALPHA. Two things this pins down that
    // the field names alone do not: decimals arrive as `fraction_decimals`,
    // and the amounts are base units — 500000 is 0.5 ALGO, not 500000 ALGO.
    // The sibling `packages/swaps` history endpoint sends display units for
    // identically named fields, so the two are easy to conflate.
    const MAINNET_SWAP_ROW = {
        id: 'TGPRD6UIKWDZZLDNJZ2KUVAULOOGA2ETS7EC2GKLOVLHLPE7MYOQ',
        tx_type: 'pay',
        sender: 'OECESM7F',
        receiver: 'V73GWLED',
        confirmed_round: '64655460',
        round_time: '1788344501',
        fee: '11000',
        group_id: 'iMt2B0L9rkzCC9tnkdF0HPeeUsi7h/a2pfiFut8dOxY=',
        amount: '5000',
        close_to: null,
        application_id: null,
        inner_transaction_count: 0,
        asset: { asset_id: '0', unit_name: 'ALGO', fraction_decimals: 6 },
        swap_group_detail: {
            swap_id: '3750430246201302705',
            provider: 'folks-router',
            status: 'completed',
            asset_in: {
                asset_id: '0',
                unit_name: 'ALGO',
                fraction_decimals: 6,
            },
            asset_out: {
                asset_id: '2726252423',
                unit_name: 'ALPHA',
                fraction_decimals: 6,
            },
            amount_in: '500000',
            amount_out: '6638534',
            transaction_count: null,
            confirmed_round: null,
            round_time: null,
        },
        interpreted_meaning: { type: 'swap' },
        balance_impacts: [
            {
                asset_id: 0,
                unit_name: 'ALGO',
                fraction_decimals: 6,
                amount: '-16000',
            },
        ],
    }

    it('maps a real swap row onto the domain model', () => {
        const { results } = parseTransactionHistoryResponse({
            results: [MAINNET_SWAP_ROW],
        })
        expect(results).toHaveLength(1)

        const item = transformTransactionItem(results[0])

        expect(item.swapGroupDetail).toEqual({
            assetInId: '0',
            assetInUnitName: 'ALGO',
            assetInDecimals: 6,
            assetOutId: '2726252423',
            assetOutUnitName: 'ALPHA',
            assetOutDecimals: 6,
            amountIn: new Decimal('500000'),
            amountOut: new Decimal('6638534'),
        })
        expect(item.asset?.unitName).toBe('ALGO')
        expect(item.asset?.decimals).toBe(6)
        expect(item.balanceImpacts[0]?.fractionDecimals).toBe(6)
    })
})
