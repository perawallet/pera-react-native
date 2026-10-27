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
import { useQueries } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useStableIdList, type Nullable } from '@perawallet/wallet-core-shared'
import {
    selectChainNetworkId,
    useChainCapabilityCheck,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import {
    isTestTierScope,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { WalletAccount } from '../models'
import {
    accountChainEntries,
    useOtherRegisteredChainIds,
} from './accountChainEntries'
import { getAccountSummaryQueryKey } from './querykeys'
import { readAccountSummary } from './useAccountSummaryQuery'
import { valueAccountTotals } from './valueAccountTotals'

export type AccountValueTotals = {
    /**
     * Value of the account's holdings on this chain, in its native asset
     * (display units); `null` when unknown — see `valueAccountTotals`.
     */
    nativeValue: Nullable<Decimal>
    /**
     * Account value in USD (display units); `null` when the native asset is
     * held but its price has never synced, so the value is genuinely unknown —
     * not 0.
     */
    usdValue: Nullable<Decimal>
    /**
     * Same contract as `AccountBalance.fiatValue`. Unlike `usdValue`, an
     * unpriced native balance is `null` on every network.
     */
    fiatValue: Nullable<Decimal>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export type AccountValueTotalsMap = Map<string, AccountValueTotals>

export type UseAccountValueTotalsQueryResult = {
    /**
     * Keyed by address, one entry per chain an account is on: an account
     * derived on two chains has two.
     */
    accountValueTotals: AccountValueTotalsMap
    /**
     * Over holdings on `scope`'s chain only, since other chains' native assets
     * don't add; `null` when any of them is unknown.
     */
    portfolioNativeValue: Nullable<Decimal>
    /**
     * Over the accounts on `scope`'s chain only; `null` when any of their USD
     * values is unknown — see `usdValue`. `0` when `hasFiatTotal` is false.
     */
    portfolioUsdValue: Nullable<Decimal>
    /**
     * Over every account on every registered chain, leaving out holdings on a
     * test-tier network. Sums each counted account's priced holdings, an
     * unpriced native balance counting 0; `null` only when something counted
     * is unknown and nothing counted is priced.
     */
    portfolioFiatValue: Nullable<Decimal>
    /** `portfolioFiatValue` is a number that leaves out the unpriced native balance of a counted account. */
    isPortfolioFiatValuePartial: boolean
    /** False on a test-tier scope, whose value never counts toward the fiat total. */
    hasFiatTotal: boolean
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

const EMPTY_RESULT_BASE = {
    portfolioNativeValue: new Decimal(0),
    portfolioUsdValue: new Decimal(0),
    portfolioFiatValue: new Decimal(0),
    isPortfolioFiatValuePartial: false,
    isPending: false,
    isFetched: false,
    isRefetching: false,
    isError: false,
    isPaused: false,
}

/**
 * Account values without the per-holding rows: one SQL aggregate per account
 * (shared, by query key, with `useAccountSummaryQuery`'s header read) instead
 * of `useAccountBalancesQuery`'s full holdings walk. This is what the account
 * list, sort sheet, and portfolio header should use — on a 10k-asset wallet
 * the holdings walk is a multi-second JS stall per render storm.
 * Reach for `useAccountBalancesQuery` only where per-asset rows are needed.
 */
export const useAccountValueTotalsQuery = (
    accounts: WalletAccount[],
    scope: ChainScope,
    enabled?: boolean,
): UseAccountValueTotalsQueryResult => {
    const hasAccounts = !!accounts?.length
    const hasFiatTotal = useMemo(
        () => !isTestTierScope(getProvider().chains, scope),
        [scope],
    )
    const check = useChainCapabilityCheck()
    const otherChainIds = useOtherRegisteredChainIds(scope.chainId)
    // See `valueAccountTotals`: only a chain with a price source can be
    // missing a price it ought to have. Joined so the memo below keys on a
    // primitive rather than the per-render checker.
    const pricedChainsKey = [scope.chainId, ...otherChainIds]
        .filter(chainId => check({ chain: { chainId, capability: 'pricing' } }))
        .join()
    // Holdings on another chain are valued at that chain's selected network;
    // a primitive so only a network switch re-keys their queries.
    const otherNetworksKey = useNetworkStore(state =>
        otherChainIds
            .map(
                chainId => `${chainId}:${selectChainNetworkId(state, chainId)}`,
            )
            .join(),
    )

    // Call sites routinely pass fresh array literals per render; only each
    // account's chain entries are read below, so the memos key on this stable
    // `home|chainId|address` list instead of array identity (see
    // useAccountBalancesQuery for the long version).
    const valuedOn = useStableIdList(
        accounts?.flatMap(account =>
            accountChainEntries(account, scope.chainId, otherChainIds).map(
                ({ chainId, address, isHome }) =>
                    `${isHome ? 1 : 0}|${chainId}|${address}`,
            ),
        ) ?? [],
    )

    const entries = useMemo(() => {
        const networks = useNetworkStore.getState()
        const { chains } = getProvider()
        return valuedOn.map(id => {
            const [home, chainId, address] = id.split('|') as [
                string,
                ChainId,
                string,
            ]
            const isHome = home === '1'
            const entryScope = isHome
                ? scope
                : {
                      chainId,
                      networkId: selectChainNetworkId(networks, chainId),
                  }
            return {
                address,
                isHome,
                scope: entryScope,
                // Each chain sits on its own network, so a test-tier one is
                // left out of the fiat totals entry by entry.
                hasFiatTotal: !isTestTierScope(chains, entryScope),
            }
        })
        // `otherNetworksKey` stands in for the network store read above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [valuedOn, scope, otherNetworksKey])

    const queries = useMemo(() => {
        return entries.map(({ address, scope: accountScope }) => {
            return {
                queryKey: getAccountSummaryQueryKey(address, accountScope),
                enabled: !!address && enabled !== false,
                staleTime: Infinity,
                // SQLite is the source of truth; run the queryFn even while
                // offline instead of pausing it (TanStack's default
                // networkMode: 'online'), which would strand consumers in
                // `pending`.
                networkMode: 'always' as const,
                // See useAccountBalancesQuery: works around a QueriesObserver
                // race under Proxy-based property tracking.
                notifyOnChangeProps: 'all' as const,
                queryFn: () => readAccountSummary(address, accountScope),
            }
        })
    }, [entries, enabled])

    const results = useQueries({ queries })

    // Stable stand-in for `results`, whose array identity churns per render.
    const resultsSig = results
        .map(
            (r, i) =>
                `${valuedOn[i] ?? ''}|${r.dataUpdatedAt}|${
                    r.isPending ? 1 : 0
                }${r.isFetched ? 1 : 0}${r.isRefetching ? 1 : 0}${
                    r.isError ? 1 : 0
                }${r.isPaused ? 1 : 0}`,
        )
        .join('||')

    return useMemo(() => {
        if (!hasAccounts) {
            return {
                accountValueTotals: new Map() as AccountValueTotalsMap,
                ...EMPTY_RESULT_BASE,
                hasFiatTotal,
            }
        }

        const pricedChains = new Set(pricedChainsKey.split(','))
        // Single-chain wallets keep today's native figures; see
        // `valueAccountTotals`.
        const isUnconvertibleUnknown = otherChainIds.length > 0
        let portfolioNativeValue: Nullable<Decimal> = new Decimal(0)
        let portfolioUsdValue: Nullable<Decimal> = new Decimal(0)
        let pricedFiatSum = new Decimal(0)
        let hasUnpricedFiat = false
        const accountValueTotals: AccountValueTotalsMap = new Map(
            entries.map((entry, i) => {
                const { address, isHome, scope: accountScope } = entry
                const r = results[i]
                const { nativeValue, usdValue, fiatValue, pricedFiatValue } =
                    valueAccountTotals(
                        r?.data,
                        pricedChains.has(accountScope.chainId),
                        isUnconvertibleUnknown,
                    )

                // One unknown account makes a portfolio total unknown —
                // silently summing the rest would understate it.
                if (isHome) {
                    portfolioNativeValue =
                        portfolioNativeValue === null || nativeValue === null
                            ? null
                            : portfolioNativeValue.plus(nativeValue)
                }
                if (isHome && entry.hasFiatTotal) {
                    portfolioUsdValue =
                        portfolioUsdValue === null || usdValue === null
                            ? null
                            : portfolioUsdValue.plus(usdValue)
                }
                // The cross-chain fiat total sums the priced part instead and
                // flags what it leaves out, so one unpriced chain can't blank it.
                if (entry.hasFiatTotal) {
                    pricedFiatSum = pricedFiatSum.plus(pricedFiatValue)
                    hasUnpricedFiat ||= fiatValue === null
                }

                return [
                    address,
                    {
                        nativeValue,
                        usdValue,
                        fiatValue,
                        isPending: r?.isPending ?? false,
                        isFetched: r?.isFetched ?? false,
                        isRefetching: r?.isRefetching ?? false,
                        isError: r?.isError ?? false,
                    },
                ]
            }),
        )

        const portfolioFiatValue =
            hasUnpricedFiat && pricedFiatSum.isZero() ? null : pricedFiatSum

        return {
            accountValueTotals,
            portfolioNativeValue,
            portfolioUsdValue,
            portfolioFiatValue,
            isPortfolioFiatValuePartial:
                hasUnpricedFiat && portfolioFiatValue !== null,
            hasFiatTotal,
            isPending: results.some(r => r.isPending),
            isFetched: results.every(r => r.isFetched),
            isRefetching: results.some(r => r.isRefetching),
            isError: results.some(r => r.isError),
            isPaused: results.some(r => r.isPaused),
        }
        // `results` is read inside but deliberately not a dep — `resultsSig`
        // is its stable stand-in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        resultsSig,
        entries,
        hasAccounts,
        pricedChainsKey,
        otherChainIds,
        hasFiatTotal,
    ])
}
