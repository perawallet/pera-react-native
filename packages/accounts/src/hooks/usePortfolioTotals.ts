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
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { AccountBalances } from '../models'

type PortfolioTotals = {
    portfolioUsdValue: Decimal
    accountUsdValues: Map<string, Decimal>
    isPending: boolean
}

export const usePortfolioTotals = (
    accountBalances: AccountBalances,
): PortfolioTotals => {
    const { usdToPreferred } = useCurrency()

    return useMemo(() => {
        const accountUsdValues = new Map<string, Decimal>()
        let portfolioUsdValue = new Decimal(0)

        // Each asset balance already carries its joined USD price from the DB
        // read, so there's no separate `WHERE assetId IN (…)` price query here.
        accountBalances.forEach((balance, address) => {
            let accountUsdTotal = new Decimal(0)
            balance.assetBalances.forEach(assetBalance => {
                const usdPrice = assetBalance.usdPrice ?? new Decimal(0)
                accountUsdTotal = accountUsdTotal.plus(
                    assetBalance.amount.times(usdPrice),
                )
            })
            accountUsdValues.set(address, accountUsdTotal)
            portfolioUsdValue = portfolioUsdValue.plus(accountUsdTotal)
        })

        return {
            portfolioUsdValue,
            accountUsdValues,
            isPending: false,
        }
    }, [accountBalances, usdToPreferred])
}
