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
import {
    CurrencyAmount,
    type CurrencyAmountProps,
} from '@components/CurrencyAmount'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { usePreferredAmount } from './usePreferredAmount'
import type { Maybe } from '@perawallet/wallet-core-shared'

/**
 * How precisely a preferred-currency value (fiat or ALGO) is rendered:
 * - `compact` — fixed 2 dp, for dense lists/rows and summary totals.
 * - `detailed` — trims 2 dp up to the preferred max, so small values, sub-cent
 *   fiat, and unit prices keep their digits.
 *
 * This maps to a {@link CurrencyAmount} precision variant; the digit counts
 * themselves live in `resolvePrecision`, never here.
 */
type PreferredAmountDensity = 'compact' | 'detailed'

type SharedPreferredProps = {
    density?: PreferredAmountDensity
} & Omit<
    CurrencyAmountProps,
    'currency' | 'value' | 'precision' | 'assetDecimals'
>

/** Convert an amount in `sourceAssetId`'s units to the preferred currency. */
type ConvertProps = SharedPreferredProps & {
    sourceAmount: Maybe<Decimal>
    sourceAssetId: string
    forceFallback?: boolean
    usdPrice?: Decimal
    value?: never
}

/** Render a value already expressed in the preferred currency, as-is. */
type PrecomputedProps = SharedPreferredProps & {
    value: Maybe<Decimal>
    sourceAmount?: never
    sourceAssetId?: never
    forceFallback?: never
    usdPrice?: never
}

export type PreferredAmountProps = ConvertProps | PrecomputedProps

const precisionFor = (density: PreferredAmountDensity) =>
    density === 'compact' ? 'compact' : 'preferredFull'

const ConvertedPreferredAmount = ({
    sourceAmount,
    sourceAssetId,
    forceFallback,
    usdPrice,
    density = 'detailed',
    ...displayProps
}: ConvertProps) => {
    const { displayCurrency, convertedValue, isPending } = usePreferredAmount(
        sourceAmount,
        sourceAssetId,
        forceFallback,
        usdPrice,
    )

    return (
        <CurrencyAmount
            currency={displayCurrency}
            value={convertedValue}
            {...displayProps}
            isLoading={isPending || displayProps.isLoading}
            precision={precisionFor(density)}
        />
    )
}

const PrecomputedPreferredAmount = ({
    value,
    density = 'detailed',
    ...displayProps
}: PrecomputedProps) => {
    const { preferredCurrency } = useCurrency()

    return (
        <CurrencyAmount
            currency={preferredCurrency}
            value={value}
            {...displayProps}
            precision={precisionFor(density)}
        />
    )
}

const isConvertProps = (props: PreferredAmountProps): props is ConvertProps =>
    'sourceAssetId' in props && props.sourceAssetId !== undefined

/**
 * A value in the user's preferred currency (fiat or ALGO). Owns the preferred
 * currency itself — give it either a `sourceAmount` (+ `sourceAssetId`) to
 * convert, or an already-preferred `value` to render directly.
 */
export const PreferredAmount = (props: PreferredAmountProps) =>
    isConvertProps(props) ? (
        <ConvertedPreferredAmount {...props} />
    ) : (
        <PrecomputedPreferredAmount {...props} />
    )
