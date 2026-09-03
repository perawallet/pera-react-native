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

import { type Decimal } from 'decimal.js'
import {
    microAlgosToAlgos,
    baseUnitsToDisplayUnits,
} from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET_NAME } from '@perawallet/wallet-core-shared'
import type { TransactionBalanceImpact } from '@perawallet/wallet-core-transactions'

/** Maximum number of stacked amounts shown in a list row before overflow. */
export const MAX_VISIBLE_AMOUNTS = 2

/**
 * Decimals reach here straight from the backend, which substitutes placeholder
 * asset facts when its enrichment fails. `Decimal.pow(10, …)` throws on a
 * non-number and happily inflates on a negative one, and this runs inside a
 * list row's memo, so one bad value would take out the whole list.
 */
export const safeDecimals = (decimals: number): number =>
    isNaN(decimals) ? 0 : Math.max(0, Math.min(19, decimals))

export type AmountDisplay = {
    /** Raw amount value for CurrencyAmount */
    value: Decimal
    /** Currency code (e.g., 'ALGO', 'USDC') */
    currency: string
    /** Prefix to show (e.g., '+', '-'). Also determines styling: '+' = positive (green), '-' = negative (red). Undefined for zero values. */
    prefix?: '+' | '-'
}

/**
 * Creates an AmountDisplay for an ALGO amount (in microAlgos).
 */
export const createAlgoAmount = (
    microAlgos: Decimal,
    isOutgoing: boolean,
): AmountDisplay => {
    const absValue = microAlgosToAlgos(microAlgos).abs()

    return {
        value: absValue,
        currency: ALGO_ASSET_NAME,
        prefix: absValue.isZero() ? undefined : isOutgoing ? '-' : '+',
    }
}

/**
 * Creates an AmountDisplay for an asset amount (in base units).
 */
export const createAssetAmount = (
    amount: Decimal,
    decimals: number,
    unitName: string,
    isOutgoing: boolean,
): AmountDisplay => {
    const absValue = baseUnitsToDisplayUnits(
        amount,
        safeDecimals(decimals),
    ).abs()

    return {
        value: absValue,
        currency: unitName,
        prefix: absValue.isZero() ? undefined : isOutgoing ? '-' : '+',
    }
}

/**
 * Creates an AmountDisplay from a backend-computed balance impact. The impact
 * amount is signed (negative = sent, positive = received), so the direction is
 * read from its sign rather than from the account being sender/receiver.
 */
export const createBalanceImpactAmount = (
    impact: TransactionBalanceImpact,
): AmountDisplay => {
    const absValue = baseUnitsToDisplayUnits(
        impact.amount.abs(),
        safeDecimals(impact.fractionDecimals),
    )

    return {
        value: absValue,
        currency: impact.unitName,
        prefix: impact.amount.isZero()
            ? undefined
            : impact.amount.isNegative()
              ? '-'
              : '+',
    }
}

/**
 * Creates an AmountDisplay for a swap's output amount, always shown as received
 * (positive).
 */
export const createSwapAmount = (
    amountOut: Decimal,
    decimals: number,
    unitName: string,
): AmountDisplay => {
    const absValue = baseUnitsToDisplayUnits(
        amountOut,
        safeDecimals(decimals),
    ).abs()

    return {
        value: absValue,
        currency: unitName,
        prefix: absValue.isZero() ? undefined : '+',
    }
}
