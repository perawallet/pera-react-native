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

import { useCallback } from 'react'
import { Decimal } from 'decimal.js'
import {
    useCurrency,
    usePreferredCurrencyPriceQuery,
} from '@perawallet/wallet-core-currencies'
import { findNativeAsset, useNativeAsset } from '@perawallet/wallet-core-assets'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import {
    LEGACY_CHAIN_ID,
    type AssetRef,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'

export type AssetFiatValue = {
    displayCurrency: string
    value: Nullable<Decimal>
}

export type AssetFiatConverter = (
    /** Null for a plain USD amount that isn't one asset's holding. */
    ref: Nullable<AssetRef>,
    usdPrice: Maybe<Decimal>,
    amountDisplayUnits: Decimal,
) => AssetFiatValue

/**
 * Returns a stable function that converts a single holding to the preferred
 * currency. The exchange rates are read **once** here at the list level (no
 * per-row React Query observers), and visible rows call the returned function
 * during render — so the conversion is done only for the ~handful of on-screen
 * rows, not all N holdings on every data change. Mirrors
 * `usePreferredAmount`'s conversion exactly so the result is
 * identical to the shared display component.
 */
const NO_CHAIN_IDS: ReadonlySet<ChainId> = new Set()

/** `unreadChainIds`: chains whose holdings no read vouches for, so a zero there may be a placeholder. */
export const useAssetListFiatConverter = (
    unreadChainIds: ReadonlySet<ChainId> = NO_CHAIN_IDS,
): AssetFiatConverter => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const nativeAsset = useNativeAsset(scope)
    const { preferredCurrency, fallbackCurrency, usdToPreferred } =
        useCurrency(scope)
    const isPreferredAlgo = preferredCurrency === nativeAsset.unitName

    // ALGO-denominated holdings can't price in ALGO, so they fall back to the
    // fiat currency — only fetch that rate when the preferred currency is ALGO.
    const { data: fallbackRate } = usePreferredCurrencyPriceQuery(
        fallbackCurrency,
        isPreferredAlgo,
    )

    return useCallback(
        (ref, knownUsdPrice, amountDisplayUnits) => {
            // A placeholder zero is unknown, not worth nothing.
            if (
                ref !== null &&
                amountDisplayUnits.isZero() &&
                unreadChainIds.has(ref.chainId)
            ) {
                return { displayCurrency: preferredCurrency, value: null }
            }
            // Holding none is worth nothing, whether or not the asset is priced.
            const usdPrice =
                knownUsdPrice ??
                (amountDisplayUnits.isZero() ? new Decimal(0) : null)
            if (usdPrice === null) {
                return { displayCurrency: preferredCurrency, value: null }
            }

            // A chain's native asset can't price in itself, whichever chain
            // the holding is on.
            const native = ref ? findNativeAsset(ref.chainId) : undefined
            const needsFallback =
                native !== undefined &&
                native.assetId === ref?.assetId &&
                native.unitName === preferredCurrency
            const usdValue = amountDisplayUnits.mul(usdPrice)
            // An unresolved fallback rate yields no value, not a zero one —
            // the row renders a placeholder instead of claiming the holding
            // is worth nothing.
            const value = needsFallback
                ? (fallbackRate?.usdPrice?.mul(usdValue) ?? null)
                : usdToPreferred(usdValue)

            return {
                displayCurrency: needsFallback
                    ? fallbackCurrency
                    : preferredCurrency,
                value,
            }
        },
        [
            preferredCurrency,
            fallbackCurrency,
            usdToPreferred,
            fallbackRate,
            unreadChainIds,
        ],
    )
}
