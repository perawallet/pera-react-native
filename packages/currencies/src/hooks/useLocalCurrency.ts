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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { isAlgoAssetName, type Nullable } from '@perawallet/wallet-core-shared'
import { useCurrency } from './useCurrency'
import { useCurrenciesQuery } from './useCurrenciesQuery'
import { usePreferredCurrencyPriceQuery } from './usePreferredCurrencyPriceQuery'

export type UseLocalCurrencyResult = {
    localCurrency: string
    localCurrencySymbol: string
    localRate: Nullable<Decimal>
}

/**
 * Resolves the user's local fiat currency and the USD→fiat rate used for
 * conversions. The local currency is the app's preferred currency when that
 * is a fiat, or the fallback fiat (USD) when the app currency is ALGO. The
 * symbol falls back to the currency code when unknown.
 */
export const useLocalCurrency = (): UseLocalCurrencyResult => {
    const { preferredCurrency, fallbackCurrency, usdToPreferred } =
        useCurrency()

    const isAlgoPreferred = isAlgoAssetName(preferredCurrency)
    const localCurrency = isAlgoPreferred ? fallbackCurrency : preferredCurrency

    const { data: currencies } = useCurrenciesQuery()
    const localCurrencySymbol = useMemo(
        () =>
            currencies?.find(currency => currency.id === localCurrency)
                ?.symbol ?? localCurrency,
        [currencies, localCurrency],
    )

    const { data: fallbackRate } = usePreferredCurrencyPriceQuery(
        fallbackCurrency,
        isAlgoPreferred,
    )
    const localRate = useMemo<Nullable<Decimal>>(() => {
        if (isAlgoPreferred) return fallbackRate?.usdPrice ?? null
        return usdToPreferred(new Decimal(1))
    }, [isAlgoPreferred, fallbackRate, usdToPreferred])

    return { localCurrency, localCurrencySymbol, localRate }
}
