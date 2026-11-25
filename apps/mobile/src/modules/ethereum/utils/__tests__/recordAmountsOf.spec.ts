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
import { recordAmountsOf } from '../recordAmountsOf'

const REF = { chainId: 'ethereum', assetId: '0xusdc' } as const

const summary = (
    overrides: Partial<TransactionSummary>,
): TransactionSummary => ({
    kind: 'token-transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    icon: 'send',
    ...overrides,
})

describe('recordAmountsOf', () => {
    it("takes the summary's balance changes ahead of its amount, what left the account first", () => {
        const received = {
            assetRef: { ...REF, assetId: 'native' },
            value: new Decimal(2),
        }
        const spent = { assetRef: REF, value: new Decimal(-5) }

        expect(
            recordAmountsOf(
                summary({
                    balanceChanges: [received, spent],
                    amount: { assetRef: REF, value: new Decimal(9) },
                }),
            ),
        ).toEqual([spent, received])
    })

    it.each([
        ['out', new Decimal(-5)],
        ['in', new Decimal(5)],
        ['self', new Decimal(5)],
        ['none', new Decimal(5)],
    ] as const)(
        'signs an unsigned amount by its direction (%s)',
        (direction, value) => {
            const [change] = recordAmountsOf(
                summary({
                    direction,
                    amount: {
                        assetRef: REF,
                        value: new Decimal(5),
                        display: { symbol: 'USDC', decimals: 6 },
                    },
                }),
            )

            expect(change).toEqual({
                assetRef: REF,
                value,
                display: { symbol: 'USDC', decimals: 6 },
            })
        },
    )

    it('has nothing for a summary with neither', () => {
        expect(recordAmountsOf(summary({}))).toEqual([])
    })
})
