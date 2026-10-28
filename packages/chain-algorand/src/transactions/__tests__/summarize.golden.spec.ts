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
    algorandHistoryDataOf,
    EMPTY_ALGORAND_HISTORY_DATA,
} from '../history-data'
import { summarizeAlgorandHistoryItem } from '../summarize'
import { ALGORAND_HISTORY_SUMMARY_GOLDENS } from '../../test-utils/history-summary-goldens'

describe('summarizeAlgorandHistoryItem', () => {
    it.each(ALGORAND_HISTORY_SUMMARY_GOLDENS)(
        'summarises $name',
        ({ item, account, summary }) => {
            expect(summarizeAlgorandHistoryItem(item, account)).toEqual(summary)
        },
    )

    it('keeps the swap subtitle but drops the amount when the output side has no asset id', () => {
        const swap = ALGORAND_HISTORY_SUMMARY_GOLDENS.find(
            golden => golden.name === 'swap',
        )!

        const summary = summarizeAlgorandHistoryItem(
            {
                ...swap.item,
                chainData: {
                    ...algorandHistoryDataOf(swap.item),
                    swapGroupDetail: {
                        ...algorandHistoryDataOf(swap.item).swapGroupDetail!,
                        assetOutId: null,
                    },
                },
            },
            swap.account,
        )

        expect(summary.amount).toBeUndefined()
        expect(summary.subtitle?.key).toBe(
            'transactions.list_item.swap_subtitle',
        )
    })

    it('prefers the ALGO facts over a placeholder the backend substituted', () => {
        const swap = ALGORAND_HISTORY_SUMMARY_GOLDENS.find(
            golden => golden.name === 'swap',
        )!

        const summary = summarizeAlgorandHistoryItem(
            {
                ...swap.item,
                chainData: {
                    ...algorandHistoryDataOf(swap.item),
                    swapGroupDetail: {
                        ...algorandHistoryDataOf(swap.item).swapGroupDetail!,
                        assetInUnitName: 'asset(0)',
                        assetInDecimals: 0,
                        amountIn: new Decimal(3000),
                    },
                },
            },
            swap.account,
        )

        expect(summary.subtitle?.params).toMatchObject({
            amountIn: '0.003',
            assetIn: 'ALGO',
        })
    })

    it('summarises a row with no chain data as one with empty Algorand data', () => {
        const payment = ALGORAND_HISTORY_SUMMARY_GOLDENS[0]

        expect(
            summarizeAlgorandHistoryItem(
                { ...payment.item, chainData: null },
                payment.account,
            ),
        ).toEqual(
            summarizeAlgorandHistoryItem(
                { ...payment.item, chainData: EMPTY_ALGORAND_HISTORY_DATA },
                payment.account,
            ),
        )
    })
})
