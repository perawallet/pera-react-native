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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    MAX_VISIBLE_AMOUNTS,
    summaryAmountsOf,
    visibleAssetIdsOf,
} from '../summaryAmounts'

const ref = (assetId: string) => ({ chainId: 'ethereum' as const, assetId })

const summaryOf = (extra: Partial<TransactionSummary>): TransactionSummary => ({
    kind: 'token-transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    icon: 'send',
    direction: 'out',
    ...extra,
})

describe('summaryAmountsOf', () => {
    it('signs each balance change by its own value and drops the sign from the amount', () => {
        const amounts = summaryAmountsOf(
            summaryOf({
                direction: 'none',
                balanceChanges: [
                    { assetRef: ref('a'), value: new Decimal(-3) },
                    { assetRef: ref('b'), value: new Decimal(2) },
                    { assetRef: ref('c'), value: new Decimal(0) },
                ],
            }),
        )

        expect(
            amounts.map(({ baseUnits, prefix }) => [
                baseUnits.toNumber(),
                prefix,
            ]),
        ).toEqual([
            [3, '-'],
            [2, '+'],
            [0, undefined],
        ])
    })

    it.each([
        ['out', '-'],
        ['in', '+'],
        ['self', undefined],
    ] as const)(
        'signs a single %s amount by its direction',
        (direction, prefix) => {
            const [amount] = summaryAmountsOf(
                summaryOf({
                    direction,
                    amount: { assetRef: ref('a'), value: new Decimal(5) },
                }),
            )

            expect(amount?.prefix).toBe(prefix)
        },
    )

    it('leaves a zero amount unsigned whatever its direction', () => {
        const [amount] = summaryAmountsOf(
            summaryOf({
                amount: { assetRef: ref('a'), value: new Decimal(0) },
            }),
        )

        expect(amount?.prefix).toBeUndefined()
    })

    it('has nothing for a summary that moves nothing', () => {
        expect(summaryAmountsOf(summaryOf({}))).toEqual([])
    })
})

describe('visibleAssetIdsOf', () => {
    it('names only the amounts a row shows', () => {
        const ids = visibleAssetIdsOf(
            summaryOf({
                balanceChanges: ['a', 'b', 'c'].map(id => ({
                    assetRef: ref(id),
                    value: new Decimal(1),
                })),
            }),
        )

        expect(ids).toEqual(['a', 'b'])
        expect(ids).toHaveLength(MAX_VISIBLE_AMOUNTS)
    })
})
