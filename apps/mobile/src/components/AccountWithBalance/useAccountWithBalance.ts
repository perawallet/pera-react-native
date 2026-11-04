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
    accountValueKey,
    accountValueOf,
    isWatchAccount,
    multisigParametersOf,
    useAccountChainId,
    useAuthorityOf,
    useAccountHoldingSources,
    useAccountValueBasis,
    useAccountValueTotalsQuery,
    type AccountHoldingSource,
    type AccountValueTotalsMap,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    countsTowardFiatTotals,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Maybe, Nullable, Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useChainAvailability,
    type ChainAvailability,
} from '@hooks/useChainAvailability'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useLanguage } from '@hooks/useLanguage'

export type CrossChainTotal =
    /** In the preferred currency. `undefined` until loaded, `null` when any counted chain's value is unknown; both render a placeholder, not 0. */
    | { kind: 'fiat'; value: Maybe<Decimal> }
    /** Every chain the account holds on is a test network, whose funds never count as money; the row shows no value. */
    | { kind: 'testOnly' }
    /** The account holds on no chain this build registers. */
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
    /**
     * Set when no chain was asked for: the row then stands for the whole
     * account, so it shows this in place of one chain's balance.
     */
    crossChainTotal: Optional<CrossChainTotal>
    /**
     * The one network a watch account sits on, on a row that stands for the
     * whole account. Unset for an account that spans networks or that the
     * wallet can sign for, whose type already says what it is.
     */
    singleNetworkChainId: Optional<ChainId>
    /** The member count of a joint account, which the avatar badge shows. */
    jointParticipantCount: Optional<number>
    /** A joint account's required approvals out of its members, e.g. "Shared · 2 of 3 signers"; unset once it is rekeyed, as its members no longer sign. */
    jointSignersLabel: Optional<string>
    /** A whole-account row names only a watch account's type or network under it; the name and value say the rest. */
    shouldShowSecondaryLabel: boolean
}

/**
 * Matches the account overview's headline: test-network holdings stay out,
 * and one unknown chain makes the total unknown rather than understated.
 */
export const crossChainTotalOf = (
    sources: readonly AccountHoldingSource[],
    accountValueTotals: AccountValueTotalsMap,
    usdToPreferred: (usd: Maybe<Decimal>) => Nullable<Decimal>,
): CrossChainTotal => {
    if (sources.length === 0) return { kind: 'unavailable' }
    const counted = sources.filter(source =>
        countsTowardFiatTotals(getProvider().chains, source.scope),
    )
    if (counted.length === 0) return { kind: 'testOnly' }
    const values = counted.map(source =>
        accountValueTotals.get(
            accountValueKey(source.scope.chainId, source.address),
        ),
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
}

export const useAccountWithBalance = (
    account: WalletAccount,
    chainOverride?: ChainId,
): UseAccountWithBalanceResult => {
    const homeScope = useHomeChainScope()
    const accountChainId = useAccountChainId(account, homeScope.chainId)
    const scope = useSelectedScope(chainOverride ?? accountChainId)
    const { chainId } = scope
    const basis = useAccountValueBasis(homeScope.chainId)
    const { usdToPreferred } = useCurrency(homeScope)
    const availability = useChainAvailability(chainId)
    const isChainAgnostic = chainOverride === undefined
    const sources = useAccountHoldingSources(account)
    const { accountValueTotals } = useAccountValueTotalsQuery(
        [account],
        homeScope,
        isChainAgnostic ? sources.length > 0 : availability.isAvailable,
    )

    const chainName = chainDisplayNameOf(chainId)

    const totals = accountValueOf(account, chainId, accountValueTotals)

    const crossChainTotal = useMemo(
        (): Optional<CrossChainTotal> =>
            isChainAgnostic
                ? crossChainTotalOf(sources, accountValueTotals, usdToPreferred)
                : undefined,
        [isChainAgnostic, sources, accountValueTotals, usdToPreferred],
    )

    const singleNetworkChainId =
        isChainAgnostic && isWatchAccount(account) && sources.length === 1
            ? sources[0]?.scope.chainId
            : undefined
    const { t } = useLanguage()
    const authority = useAuthorityOf(account, scope)
    const multisig = isChainAgnostic
        ? multisigParametersOf(account, accountChainId)
        : undefined
    const jointParticipantCount = multisig?.addresses.length
    const jointSignersLabel =
        multisig && authority === null
            ? t('account_info.type_multisig_signers', {
                  threshold: multisig.threshold,
                  total: multisig.addresses.length,
              })
            : undefined

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
        crossChainTotal,
        singleNetworkChainId,
        jointParticipantCount,
        jointSignersLabel,
        shouldShowSecondaryLabel: !isChainAgnostic || isWatchAccount(account),
    }
}
