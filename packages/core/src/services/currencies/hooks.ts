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

import { useV1CurrenciesRead } from '../../api/index'
import { useAppStore } from '../../store'
import Decimal from 'decimal.js'
import { useCallback } from 'react'

export const useCurrency = () => {
    const { preferredCurrency, setPreferredCurrency } = useAppStore()

    return {
        preferredCurrency,
        setPreferredCurrency,
    }
}

export const useCurrencyConverter = () => {
    const preferredCurrency = useAppStore(state => state.preferredCurrency)
    const { data, isPending } = useV1CurrenciesRead({
        currency_id: preferredCurrency,
    })

    const convertUSDToPreferredCurrency = useCallback(
        (usdAmount: Decimal) => {
            if (isPending) {
                return Decimal(0)
            }

            const usdValue = data?.usd_value ?? '0'
            const safeUsdValue = usdValue || '0'
            return usdAmount.mul(Decimal(safeUsdValue))
        },
        [data, isPending],
    )

    const convertAssetValueToPreferredCurrency = useCallback(
        (amount: Decimal, usdPrice: Decimal) => {
            if (isPending) {
                return Decimal(0)
            }

            const usdValue = data?.usd_value ?? '0'
            const safeUsdValue = usdValue || '0'
            return amount.mul(usdPrice).mul(Decimal(safeUsdValue))
        },
        [data, isPending],
    )

    return {
        preferredCurrency,
        convertAssetValueToPreferredCurrency,
        convertUSDToPreferredCurrency,
    }
}
