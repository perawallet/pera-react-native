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
import type { CurrencyAmountProps } from '@components/CurrencyAmount'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'

/**
 * How precisely a preferred-currency value (fiat or ALGO) is rendered:
 * - `compact` — fixed 2 dp, for dense lists/rows and summary totals.
 * - `detailed` — trims 2 dp up to the preferred max, so small values, sub-cent
 *   fiat, and unit prices keep their digits.
 *
 * This maps to a {@link CurrencyAmount} precision variant; the digit counts
 * themselves live in `resolvePrecision`, never here.
 */
export type PreferredAmountDensity = 'compact' | 'detailed'

export type SharedPreferredProps = {
    density?: PreferredAmountDensity
} & Omit<
    CurrencyAmountProps,
    'currency' | 'value' | 'precision' | 'assetDecimals' | 'assetId'
>

/** Convert an amount in `sourceAssetId`'s units to the preferred currency. */
export type ConvertedPreferredAmountProps = SharedPreferredProps & {
    sourceAmount: Maybe<Decimal>
    sourceAssetId: string
    forceFallback?: boolean
    usdPrice?: Decimal
    /** The asset's chain, when it isn't the selected one. */
    scope?: ChainScope
    value?: never
}

/** Render a value already expressed in the preferred currency, as-is. */
export type PrecomputedPreferredAmountProps = SharedPreferredProps & {
    value: Maybe<Decimal>
    sourceAmount?: never
    sourceAssetId?: never
    forceFallback?: never
    usdPrice?: never
    scope?: never
}
