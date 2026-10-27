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
    accountValueOf,
    useAccountChainId,
    useAccountValueBasis,
    useAccountValueTotalsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useIsOnTestTier,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import {
    useChainAvailability,
    type ChainAvailability,
} from '@hooks/useChainAvailability'

export type UseAccountWithBalanceResult = {
    /** `chainId`, else the account's own chain, at its selected network; where its native asset is priced. */
    scope: ChainScope
    /** Undefined for a chain this build doesn't register. */
    chainName: Optional<string>
    availability: ChainAvailability
    /** In the account's own native asset. `undefined` until loaded, `null` when unknown; both render a placeholder, not 0. */
    nativeValue: Maybe<Decimal>
    /** The account's fiat value on `scope`'s chain, in the preferred currency. `undefined` until loaded, `null` when unpriced or the rate is unresolved; both render a placeholder, not 0. */
    preferredValue: Maybe<Decimal>
    /** Once the wallet holds accounts on another chain, so rows tell chains apart. */
    isMultiChain: boolean
    isTestTier: boolean
}

export const useAccountWithBalance = (
    account: WalletAccount,
    chainOverride?: ChainId,
): UseAccountWithBalanceResult => {
    const accountChainId = useAccountChainId(account, LEGACY_CHAIN_ID)
    const scope = useSelectedScope(chainOverride ?? accountChainId)
    const { chainId } = scope
    const homeScope = useSelectedScope(LEGACY_CHAIN_ID)
    const basis = useAccountValueBasis(LEGACY_CHAIN_ID)
    const { usdToPreferred } = useCurrency(homeScope)
    const availability = useChainAvailability(chainId)
    const { accountValueTotals } = useAccountValueTotalsQuery(
        [account],
        homeScope,
        availability.isAvailable,
    )
    const chainIds = useMemo(
        () => Object.keys(account.chains) as ChainId[],
        [account.chains],
    )
    const isTestTier = useIsOnTestTier(chainIds)

    const chainName = chainDisplayNameOf(chainId)

    const totals = accountValueOf(account, chainId, accountValueTotals)

    return {
        scope,
        chainName,
        availability,
        nativeValue: totals?.nativeValue,
        preferredValue:
            totals && !totals.isPending
                ? usdToPreferred(totals.fiatValue)
                : undefined,
        isMultiChain: basis === 'fiat',
        isTestTier,
    }
}
