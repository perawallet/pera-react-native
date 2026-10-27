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
import {
    accountValueOf,
    useAccountChainId,
    useAccountHoldingSources,
    useAccountValueBasis,
    useAccountValueTotalsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isTestTierScope,
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
import type {
    Maybe,
    Nullable,
    Optional,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useChainAvailability,
    type ChainAvailability,
} from '@hooks/useChainAvailability'

export type CrossChainTotal =
    /** In the preferred currency. `undefined` until loaded, `null` when any counted chain's value is unknown; both render a placeholder, not 0. */
    | { kind: 'fiat'; value: Maybe<Decimal> }
    /** Every chain the account holds on is a test network, whose funds never count as money. */
    | { kind: 'testOnly' }
    /** Every chain the account is on is switched off. */
    | { kind: 'unavailable' }

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
    /**
     * Set when no chain was asked for and the wallet spans chains: the row then
     * stands for the whole account, so it shows this in place of one chain's balance.
     */
    crossChainTotal: Optional<CrossChainTotal>
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
    const isChainAgnostic = chainOverride === undefined && basis === 'fiat'
    // Leaves out switched-off chains, so their last-synced values can't count.
    const sources = useAccountHoldingSources(account)
    const { accountValueTotals } = useAccountValueTotalsQuery(
        [account],
        homeScope,
        isChainAgnostic ? sources.length > 0 : availability.isAvailable,
    )
    const chainIds = useMemo(
        () => Object.keys(account.chains) as ChainId[],
        [account.chains],
    )
    const isTestTier = useIsOnTestTier(chainIds)

    const chainName = chainDisplayNameOf(chainId)

    const totals = accountValueOf(account, chainId, accountValueTotals)

    // Matches the account overview's headline: test-network holdings stay out,
    // and one unknown chain makes the total unknown rather than understated.
    const crossChainTotal = useMemo((): Optional<CrossChainTotal> => {
        if (!isChainAgnostic) return undefined
        if (sources.length === 0) return { kind: 'unavailable' }
        const counted = sources.filter(
            source => !isTestTierScope(getProvider().chains, source.scope),
        )
        if (counted.length === 0) return { kind: 'testOnly' }
        const values = counted.map(source =>
            accountValueTotals.get(source.address),
        )
        if (values.some(value => !value || value.isPending)) {
            return { kind: 'fiat', value: undefined }
        }
        const usdTotal = values.reduce<Nullable<Decimal>>(
            (total, value) =>
                total === null || !value || value.fiatValue === null
                    ? null
                    : total.plus(value.fiatValue),
            new Decimal(0),
        )
        return { kind: 'fiat', value: usdToPreferred(usdTotal) }
    }, [isChainAgnostic, sources, accountValueTotals, usdToPreferred])

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
        crossChainTotal,
    }
}
