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
import {
    isAlgoAssetName,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useCurrenciesStore } from '../store'
import { USD_CURRENCY_ID } from '../constants'
import { usePreferredCurrencyPriceQuery } from './usePreferredCurrencyPriceQuery'
import { useAlgoUsdPriceQuery } from './useAlgoUsdPriceQuery'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'

export type UseCurrencyResult = {
    preferredCurrency: string
    setPreferredCurrency: (currency: string) => void
    fallbackCurrency: string
    setFallbackCurrency: (currency: string) => void
    /**
     * Converts a USD amount into the preferred currency. Returns `null` when
     * the backing rate is unknown (still loading, absent, or zero) and when
     * the amount itself is unknown — unknown in, unknown out. Never returns 0
     * for either: a displayed 0 must mean a real zero balance.
     */
    usdToPreferred: (usdAmount: Maybe<Decimal>) => Nullable<Decimal>
    /** True while the rate `usdToPreferred` needs has not resolved. */
    isRatePending: boolean
    /** `null` until the ALGO/USD rate is known. */
    algoUsdPrice: Nullable<Decimal>
}

export const useCurrency = (): UseCurrencyResult => {
    const { network } = useNetwork()
    const preferredCurrency = useCurrenciesStore(
        state => state.preferredCurrency,
    )
    const setPreferredCurrency = useCurrenciesStore(
        state => state.setPreferredCurrency,
    )
    const fallbackCurrency = useCurrenciesStore(state => state.fallbackCurrency)
    const setFallbackCurrency = useCurrenciesStore(
        state => state.setFallbackCurrency,
    )

    const isAlgoPreferred = isAlgoAssetName(preferredCurrency)

    const { data: preferredRate, isPending: preferredRatePending } =
        usePreferredCurrencyPriceQuery(preferredCurrency, !isAlgoPreferred)

    const { data: algoUsdPrice, isPending: algoUsdPricePending } =
        useAlgoUsdPriceQuery(isAlgoPreferred)

    // A zero rate normally means "not synced yet" — no real currency trades at
    // 0 against USD. But on a network with no Pera backend the API layer
    // synthesizes a zero rate on purpose so fiat renders as 0 (PERA-4928), and
    // that is a resolved answer, not an absence. Treating it as pending there
    // would swap those networks' 0 for a placeholder while fully online.
    const isZeroRateUnresolved = isPeraBackedNetwork(network)

    // USD needs no rate, so it is never pending.
    const isRatePending =
        preferredCurrency === USD_CURRENCY_ID
            ? false
            : isAlgoPreferred
              ? algoUsdPricePending ||
                !algoUsdPrice ||
                (algoUsdPrice.isZero() && isZeroRateUnresolved)
              : preferredRatePending ||
                !preferredRate?.usdPrice ||
                (preferredRate.usdPrice.isZero() && isZeroRateUnresolved)

    const usdToPreferred = useCallback<
        (usdAmount: Maybe<Decimal>) => Nullable<Decimal>
    >(
        (usdAmount: Maybe<Decimal>) => {
            if (usdAmount == null) {
                return null
            }

            if (preferredCurrency === USD_CURRENCY_ID) {
                return usdAmount
            }

            if (isRatePending) {
                return null
            }

            if (isAlgoPreferred) {
                // Only reachable with a deliberate zero rate (no Pera backend),
                // where the pre-existing contract is to render 0 rather than
                // divide by it.
                const rate = algoUsdPrice as Decimal
                return rate.isZero() ? new Decimal(0) : usdAmount.div(rate)
            }

            return usdAmount.mul(preferredRate?.usdPrice as Decimal)
        },
        [
            preferredCurrency,
            isAlgoPreferred,
            isRatePending,
            algoUsdPrice,
            preferredRate,
        ],
    )

    return {
        preferredCurrency,
        setPreferredCurrency,
        fallbackCurrency,
        setFallbackCurrency,
        usdToPreferred,
        isRatePending,
        algoUsdPrice: algoUsdPrice ?? null,
    }
}
