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
import type { MinimalAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Maybe } from '@perawallet/wallet-core-shared'

/**
 * - `detailed` (default) — the asset's natural precision (trims the default
 *   floor up to the asset's own `decimals`; collectibles / 0-decimal assets
 *   render whole).
 * - `compact` — a fixed 2 dp, for dense list rows; an asset with more than 6
 *   decimals keeps its detailed precision so a row reads like its detail.
 * - `significant` — a few significant digits, for a tiny amount such as a fee.
 */
export type AssetAmountDensity = 'compact' | 'detailed' | 'significant'

export type AssetAmountProps = {
    /**
     * The asset whose amount is shown. Supplies both the displayed unit (its
     * `unitName`) and the decimals the precision is trimmed to.
     */
    asset: Maybe<MinimalAsset>
    /** The asset's chain; decides whether `asset` is its native coin. */
    chainId: ChainId
    value: Maybe<Decimal>
    density?: AssetAmountDensity
} & Omit<
    CurrencyAmountProps,
    'currency' | 'value' | 'precision' | 'assetDecimals' | 'assetId' | 'chainId'
>

/**
 * Renders an amount of a specific asset, deriving both the displayed unit and
 * the decimals from a single `asset` so callers never repeat `currency` +
 * `assetDecimals`. The asset-side counterpart to `PreferredAmount`.
 */
export const AssetAmount = ({
    asset,
    chainId,
    value,
    density = 'detailed',
    ...displayProps
}: AssetAmountProps) => {
    const currency = asset?.unitName ?? ''
    // '' (unknown asset, e.g. still loading) stays in asset mode: no glyph, no
    // fiat-symbol mapping.
    const assetId = asset?.assetId ?? ''

    if (density === 'compact') {
        return (
            <CurrencyAmount
                currency={currency}
                assetId={assetId}
                chainId={chainId}
                value={value}
                precision='compact'
                assetDecimals={asset?.decimals}
                {...displayProps}
            />
        )
    }

    return (
        <CurrencyAmount
            currency={currency}
            assetId={assetId}
            chainId={chainId}
            value={value}
            precision={density === 'significant' ? 'significant' : 'assetFull'}
            assetDecimals={asset?.decimals}
            {...displayProps}
        />
    )
}
