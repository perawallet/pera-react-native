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
    ChainId,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'
import type { MinimalAsset } from '@perawallet/wallet-core-assets'

/** Maximum number of stacked amounts shown in a list row before overflow. */
export const MAX_VISIBLE_AMOUNTS = 2

type AmountPrefix = '+' | '-'

export type AmountDisplay = {
    /** Display units, unsigned. */
    value: Decimal
    /**
     * On-chain asset id. Currency identity is decided from this, never from
     * `currency`.
     */
    assetId: string
    /** The chain `assetId` is on. */
    chainId: ChainId
    /** Unit name, display text only. */
    currency: string
    decimals: number
    /** Also picks the colour; undefined for a zero or unsigned amount. */
    prefix?: AmountPrefix
}

export type SummaryAmount = {
    assetRef: AssetRef
    /** Base units, unsigned. */
    baseUnits: Decimal
    prefix?: AmountPrefix
    display?: AssetDisplayHint
}

const DIRECTION_PREFIX: Record<
    TransactionSummary['direction'],
    AmountPrefix | undefined
> = { in: '+', out: '-', self: undefined, none: undefined }

const signPrefix = (value: Decimal): AmountPrefix | undefined => {
    if (value.isZero()) return undefined
    return value.isNegative() ? '-' : '+'
}

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
 * Decimals can come straight from a backend that substitutes placeholder facts
 * when its enrichment fails. `Decimal.pow(10, …)` throws on a non-number and
 * inflates on a negative one, and this runs inside a list row's memo, so one
 * bad value would take out the whole list.
 */
export const safeDecimals = (decimals: number): number =>
    isNaN(decimals) ? 0 : Math.max(0, Math.min(19, decimals))

/** The asset store's facts win; the summary's own hint covers assets it doesn't hold. */
export const toAmountDisplay = (
    amount: SummaryAmount,
    storedAsset: MinimalAsset | undefined,
): AmountDisplay => {
    const decimals = storedAsset?.decimals ?? amount.display?.decimals ?? 0
    return {
        value: baseUnitsToDisplayUnits(
            amount.baseUnits,
            safeDecimals(decimals),
        ),
        assetId: amount.assetRef.assetId,
        chainId: amount.assetRef.chainId,
        currency: storedAsset?.unitName ?? amount.display?.symbol ?? '',
        decimals: safeDecimals(decimals),
        prefix: amount.prefix,
    }
}
