/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useCurrenciesStore } from '../store'
import { usePreferredCurrencyPriceQuery } from './usePreferredCurrencyPriceQuery'
import Decimal from 'decimal.js'

export const useCurrency = () => {
    const preferredCurrency = useCurrenciesStore(
        state => state.preferredCurrency,
    )
    const setPreferredCurrency = useCurrenciesStore(
        state => state.setPreferredCurrency,
    )
    const { data, isPending } =
        usePreferredCurrencyPriceQuery(preferredCurrency)

    const usdToPreferred = useCallback<(usdAmount: Decimal) => Decimal>(
        (usdAmount: Decimal) => {
            if (isPending) {
                return Decimal(0)
            }

            if (preferredCurrency === 'USD') {
                return usdAmount
            }

            const usdValue = data?.usdPrice ?? Decimal('0')
            return usdAmount.mul(usdValue)
        },
        [isPending, data, preferredCurrency],
    )

    return {
        preferredCurrency,
        setPreferredCurrency,
        usdToPreferred,
    }
}
