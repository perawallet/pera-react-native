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
import type { Decimal } from 'decimal.js'
import {
    allChainsHaveBalanceHistory,
    useAccountValueTotalsQuery,
    useSigningAccountsOnAnyChain,
    type AccountHoldingSource,
} from '@perawallet/wallet-core-accounts'
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useAccountDrawerControls } from '../AccountDrawer/AccountDrawerContext'

export type UsePortfolioViewResult = {
    scope: ChainScope
    /** `null` when the total is unknown or the rate is unresolved — renders as a placeholder, not 0. */
    portfolioPreferredValue: Nullable<Decimal>
    /** The total is a number that leaves out holdings without a price. */
    isPreferredValuePartial: boolean
    /** False on a test-tier scope, whose value never counts toward the fiat total. */
    hasFiatTotal: boolean
    /** What the headline total sums: every counted chain. The chart and trend plot these added together. */
    chartSources: AccountHoldingSource[]
    /**
     * `chartSources` is not empty and every chain in it has balance history,
     * so the chart can plot everything in the total beside it.
     */
    hasBalanceHistory: boolean
    isPending: boolean
    /**
     * False while the drawer holding this card is closed. Its content stays
     * mounted under the tab shell, so history fetches wait for this rather
     * than running at launch. True where no drawer is mounted: the web bottom
     * sheet only mounts while open.
     */
    isDrawerOpen: boolean
}

export const usePortfolioView = (): UsePortfolioViewResult => {
    const scope = useHomeChainScope()
    const isDrawerOpen = useAccountDrawerControls()?.isOpen ?? true
    const { usdToPreferred } = useCurrency(scope)

    // An account counts when it can sign on any chain it holds, so one with no
    // Algorand address, or that signs only on another chain, joins the total.
    const accounts = useSigningAccountsOnAnyChain()
    const {
        portfolioFiatValue,
        isPortfolioFiatValuePartial,
        hasFiatTotal,
        fiatTotalSources,
        isPending,
    } = useAccountValueTotalsQuery(accounts, scope)
    const check = useChainCapabilityCheck()
    const chartSources = fiatTotalSources
    const hasBalanceHistory =
        chartSources.length > 0 &&
        allChainsHaveBalanceHistory(chartSources, check)
    const portfolioPreferredValue = useMemo(
        () => usdToPreferred(portfolioFiatValue),
        [portfolioFiatValue, usdToPreferred],
    )

    return {
        scope,
        portfolioPreferredValue,
        isPreferredValuePartial:
            isPortfolioFiatValuePartial && portfolioPreferredValue !== null,
        hasFiatTotal,
        chartSources,
        hasBalanceHistory,
        isPending,
        isDrawerOpen,
    }
}
