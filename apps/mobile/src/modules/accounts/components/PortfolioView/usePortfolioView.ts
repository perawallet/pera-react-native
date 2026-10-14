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
    useAccountValueBasis,
    useAccountValueTotalsQuery,
    useSigningAccounts,
    type AccountValueBasis,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UsePortfolioViewResult = {
    scope: ChainScope
    accounts: WalletAccount[]
    /** `fiat` leads with the preferred-currency total and drops the native one, which can't sum across chains. */
    basis: AccountValueBasis
    /** `null` when unknown — renders as a placeholder, not 0. */
    portfolioNativeValue: Nullable<Decimal>
    /** `null` while any account is unpriced or the rate is unresolved — renders as a placeholder, not 0. */
    portfolioPreferredValue: Nullable<Decimal>
    isPending: boolean
}

export const usePortfolioView = (): UsePortfolioViewResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { usdToPreferred } = useCurrency()
    const basis = useAccountValueBasis(scope.chainId)

    const accounts = useSigningAccounts(scope.chainId)
    const {
        portfolioNativeValue,
        portfolioUsdValue,
        portfolioFiatValue,
        isPending,
    } = useAccountValueTotalsQuery(accounts, scope)
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
        isPending,
    }
}
