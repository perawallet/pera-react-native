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

import type { Decimal } from 'decimal.js'
import type {
    AssetDisplayHint,
    AssetRef,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

/** Maximum number of stacked amounts shown in a list row before overflow. */
export const MAX_VISIBLE_AMOUNTS = 2

export type AmountPrefix = '+' | '-'

export type SummaryAmount = {
    assetRef: AssetRef
    /** Base units, unsigned. */
    baseUnits: Decimal
    prefix?: AmountPrefix
    display?: AssetDisplayHint
}

const DIRECTION_PREFIX: Record<
    TransactionSummary['direction'],
    Optional<AmountPrefix>
> = { in: '+', out: '-', self: undefined, none: undefined }

const signPrefix = (value: Decimal): Optional<AmountPrefix> => {
    if (value.isZero()) return undefined
    return value.isNegative() ? '-' : '+'
}

/** Every amount a summary moves: its balance changes when it has them, else its one amount signed by direction. */
export const summaryAmountsOf = (
    summary: TransactionSummary,
): SummaryAmount[] => {
    if (summary.balanceChanges) {
        return summary.balanceChanges.map(({ assetRef, value, display }) => ({
            assetRef,
            baseUnits: value.abs(),
            prefix: signPrefix(value),
            display,
        }))
    }
    if (!summary.amount) return []
    const { assetRef, value, display } = summary.amount
    return [
        {
            assetRef,
            baseUnits: value.abs(),
            prefix: value.isZero()
                ? undefined
                : DIRECTION_PREFIX[summary.direction],
            display,
        },
    ]
}

/**
 * The asset ids a row shows (its visible amounts, and any asset its title
 * names), which is all its icon, names and warnings need stored.
 */
export const visibleAssetIdsOf = (summary: TransactionSummary): string[] => [
    ...new Set([
        ...summaryAmountsOf(summary)
            .slice(0, MAX_VISIBLE_AMOUNTS)
            .map(amount => amount.assetRef.assetId),
        ...Object.values(summary.titleAssets ?? {}).flatMap(ref =>
            ref ? [ref.assetId] : [],
        ),
    ]),
]
