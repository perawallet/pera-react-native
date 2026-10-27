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
    accountChainIdOf,
    useAccountValueBasis,
    useAccountValueTotalsQuery,
    useRegisteredChainIds,
    useSigningAccountsOnOwnChain,
    type AccountValueBasis,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapabilityCheck,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UsePortfolioViewResult = {
    scope: ChainScope
    accounts: WalletAccount[]
    /** `fiat` leads with the preferred-currency total and drops the native one, which can't sum across chains. */
    basis: AccountValueBasis
    /** `null` when unknown — renders as a placeholder, not 0. */
    portfolioNativeValue: Nullable<Decimal>
    /** `null` when the total is unknown or the rate is unresolved — renders as a placeholder, not 0. */
    portfolioPreferredValue: Nullable<Decimal>
    /** The `fiat` total is a number that leaves out holdings without a price. */
    isPreferredValuePartial: boolean
    /** False on a test-tier scope, whose value never counts toward the fiat total. */
    hasFiatTotal: boolean
    /**
     * Every counted account's chain has balance history. The chart and trend
     * plot only those chains, so once the total counts another they'd contradict it.
     */
    hasBalanceHistory: boolean
    isPending: boolean
}

export const usePortfolioView = (): UsePortfolioViewResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { usdToPreferred } = useCurrency(scope)
    const basis = useAccountValueBasis(scope.chainId)

    // Each account counts when it can sign on its own chain, so an Ethereum
    // account joins the fiat total without an Algorand address.
    const accounts = useSigningAccountsOnOwnChain()
    const {
        portfolioNativeValue,
        portfolioUsdValue,
        portfolioFiatValue,
        isPortfolioFiatValuePartial,
        hasFiatTotal,
        isPending,
    } = useAccountValueTotalsQuery(accounts, scope)
    const check = useChainCapabilityCheck()
    const registeredChainIds = useRegisteredChainIds()
    const hasBalanceHistory = accounts.every(account =>
        check({
            chain: {
                chainId: accountChainIdOf(account, registeredChainIds),
                capability: 'balanceHistory',
            },
        }),
    )
    const portfolioPreferredValue = useMemo(
        () =>
            usdToPreferred(
                basis === 'fiat' ? portfolioFiatValue : portfolioUsdValue,
            ),
        [basis, portfolioFiatValue, portfolioUsdValue, usdToPreferred],
    )

    return {
        scope,
        accounts,
        basis,
        portfolioNativeValue,
        portfolioPreferredValue,
        isPreferredValuePartial:
            basis === 'fiat' &&
            isPortfolioFiatValuePartial &&
            portfolioPreferredValue !== null,
        hasFiatTotal,
        hasBalanceHistory,
        isPending,
    }
}
