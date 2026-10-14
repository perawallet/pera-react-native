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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { WalletAccount } from '../models'
import { chainAccountOf } from '../credentials/accessors'
import { getAccountSummaryQueryKey } from './querykeys'
import { readAccountSummary } from './useAccountSummaryQuery'
import { valueAccountTotals } from './valueAccountTotals'

export type AccountValueTotals = {
    /** Account value expressed in its own chain's native asset (display units). */
    nativeValue: Decimal
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
    /** Keyed by each account's address on the chain it was valued on. */
    accountValueTotals: AccountValueTotalsMap
    /** Over the accounts on `scope`'s chain only; other chains' native assets don't add. */
    portfolioNativeValue: Decimal
    /**
     * Over the accounts on `scope`'s chain only; `null` when any of their USD
     * values is unknown — see `usdValue`.
     */
    portfolioUsdValue: Nullable<Decimal>
    /**
     * Over every account, on any chain; `null` when any account's fiat value is
     * unknown — see `fiatValue`.
     */
    portfolioFiatValue: Nullable<Decimal>
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
    const check = useChainCapabilityCheck()
    const otherChainIds = getProvider()
        .chains.list()
        .map(({ id }) => id)
        .filter(chainId => chainId !== scope.chainId)
    // See `valueAccountTotals`: only a chain with a price source can be
    // missing a price it ought to have. Joined so the memo below keys on a
    // primitive rather than the per-render checker.
    const pricedChainsKey = [scope.chainId, ...otherChainIds]
        .filter(chainId => check({ chain: { chainId, capability: 'pricing' } }))
        .join()
    // An account not on `scope`'s chain is valued on its own chain's selected
    // network; a primitive so only a network switch re-keys its query.
    const otherNetworksKey = useNetworkStore(state =>
        otherChainIds
            .map(
                chainId => `${chainId}:${selectChainNetworkId(state, chainId)}`,
            )
            .join(),
    )

    // Call sites routinely pass fresh array literals per render; only each
    // account's chain and address are read below, so the memos key on this
    // stable `chainId|address` list instead of array identity (see
    // useAccountBalancesQuery for the long version).
    const valuedOn = useStableIdList(
        accounts?.flatMap(account => {
            const chainId = [scope.chainId, ...otherChainIds].find(
                id => chainAccountOf(account, id) !== undefined,
            )
            const address = chainId && chainAccountOf(account, chainId)?.address
            return address ? [`${chainId}|${address}`] : []
        }) ?? [],
    )

    const entries = useMemo(() => {
        const networks = useNetworkStore.getState()
        return valuedOn.map(id => {
            const separator = id.indexOf('|')
            const chainId = id.slice(0, separator) as ChainId
            const address = id.slice(separator + 1)
            return {
                address,
                scope:
                    chainId === scope.chainId
                        ? scope
                        : {
                              chainId,
                              networkId: selectChainNetworkId(
                                  networks,
                                  chainId,
                              ),
                          },
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
            }
        }

        const pricedChains = new Set(pricedChainsKey.split(','))
        let portfolioNativeValue = new Decimal(0)
        let portfolioUsdValue: Nullable<Decimal> = new Decimal(0)
        let portfolioFiatValue: Nullable<Decimal> = new Decimal(0)
        const accountValueTotals: AccountValueTotalsMap = new Map(
            entries.map(({ address, scope: accountScope }, i) => {
                const r = results[i]
                const { nativeValue, usdValue, fiatValue } = valueAccountTotals(
                    r?.data,
                    pricedChains.has(accountScope.chainId),
                )

                // One unknown account makes a portfolio total unknown —
                // silently summing the rest would understate it.
                if (accountScope.chainId === scope.chainId) {
                    portfolioNativeValue =
                        portfolioNativeValue.plus(nativeValue)
                    portfolioUsdValue =
                        portfolioUsdValue === null || usdValue === null
                            ? null
                            : portfolioUsdValue.plus(usdValue)
                }
                portfolioFiatValue =
                    portfolioFiatValue === null || fiatValue === null
                        ? null
                        : portfolioFiatValue.plus(fiatValue)

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

        return {
            accountValueTotals,
            portfolioNativeValue,
            portfolioUsdValue,
            portfolioFiatValue,
            isPending: results.some(r => r.isPending),
            isFetched: results.every(r => r.isFetched),
            isRefetching: results.some(r => r.isRefetching),
            isError: results.some(r => r.isError),
            isPaused: results.some(r => r.isPaused),
        }
        // `results` is read inside but deliberately not a dep — `resultsSig`
        // is its stable stand-in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultsSig, entries, hasAccounts, pricedChainsKey, scope.chainId])
}
