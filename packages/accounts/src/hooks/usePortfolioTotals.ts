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
import type { AccountBalances } from '../models'

type PortfolioTotals = {
    portfolioUsdValue: Decimal
    accountUsdValues: Map<string, Decimal>
    isPending: boolean
}

/**
 * Rolls the per-account USD totals up into a portfolio total.
 *
 * The per-asset arithmetic happens once, in the same holdings pass
 * `useAccountBalancesQuery` already runs to derive `algoValue`. This hook only
 * adds up the results, so a price poll no longer re-walks every account's
 * holdings.
 */
export const usePortfolioTotals = (
    accountBalances: AccountBalances,
): PortfolioTotals => {
    return useMemo(() => {
        const accountUsdValues = new Map<string, Decimal>()
        let portfolioUsdValue = new Decimal(0)

        accountBalances.forEach((balance, address) => {
            accountUsdValues.set(address, balance.usdValue)
            portfolioUsdValue = portfolioUsdValue.plus(balance.usdValue)
        })

        return {
            portfolioUsdValue,
            accountUsdValues,
            isPending: false,
        }
    }, [accountBalances])
}
