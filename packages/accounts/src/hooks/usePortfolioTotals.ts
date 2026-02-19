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

import { useMemo } from 'react'
import Decimal from 'decimal.js'
import { useAssetPricesQuery } from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { AccountBalances } from '../models'

type PortfolioTotals = {
    portfolioPreferredValue: Decimal
    accountPreferredValues: Map<string, Decimal>
    isPending: boolean
}

export const usePortfolioTotals = (
    accountBalances: AccountBalances,
): PortfolioTotals => {
    const { data: usdPrices, isPending } = useAssetPricesQuery()
    const { usdToPreferred } = useCurrency()

    return useMemo(() => {
        const accountPreferredValues = new Map<string, Decimal>()
        let portfolioPreferredValue = Decimal(0)

        accountBalances.forEach((balance, address) => {
            let accountUsdTotal = Decimal(0)
            balance.assetBalances.forEach(assetBalance => {
                const usdPrice =
                    usdPrices?.get(assetBalance.assetId)?.usdPrice ?? Decimal(0)
                accountUsdTotal = accountUsdTotal.plus(
                    assetBalance.amount.times(usdPrice),
                )
            })
            const accountPreferred = usdToPreferred(accountUsdTotal)
            accountPreferredValues.set(address, accountPreferred)
            portfolioPreferredValue =
                portfolioPreferredValue.plus(accountPreferred)
        })

        return {
            portfolioPreferredValue,
            accountPreferredValues,
            isPending,
        }
    }, [accountBalances, usdPrices, usdToPreferred, isPending])
}
