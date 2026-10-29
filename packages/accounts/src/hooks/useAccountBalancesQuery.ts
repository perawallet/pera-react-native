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

import { useQueries } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useMemo } from 'react'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    logger,
    pow10,
    useStableIdList,
    type Maybe,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type {
    AccountBalances,
    AccountBalancesWithTotals,
    AssetWithAccountBalance,
    WalletAccount,
} from '../models'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { getAccountBalancesQueryKey } from './querykeys'
import {
    getAccountChainStateRow,
    getAccountHoldingsPage,
    type AccountHoldingsFilters,
    type AccountHoldingsPageRow,
} from '../db'
import { describeHolding } from '../chain-adapter'
import {
    useOtherRegisteredChainIds,
    useRegisteredChainIds,
} from './accountChainEntries'
import { chainAccountOf } from '../credentials/accessors'
import { fetchAndPersistAccount } from '../sync/account-syncer'
import { HOLDINGS_ROWS_GC_TIME_MS } from '../constants'

type AccountDbSnapshot = {
    holdings: AccountHoldingsPageRow[]
}

async function readAccountFromDb(
    address: string,
    scope: ChainScope,
    filters?: AccountHoldingsFilters,
): Promise<AccountDbSnapshot> {
    // If this account has no chain-state row yet the background sync either
    // hasn't run or silently failed. Pull directly from the chain before
    // reading so the UI recovers without waiting for the next poll cycle.
    const row = await getAccountChainStateRow({
        accountAddress: address,
        scope,
    })
    if (!row) {
        try {
            await fetchAndPersistAccount(address, scope)
        } catch (error) {
            logger.warn('On-demand account fetch failed', {
                address,
                scope,
                error:
                    error instanceof Error
                        ? { message: error.message, stack: error.stack }
                        : error,
            })
        }
    }

    // Single join read: each holding carries its asset metadata + USD price, so
    // there's no separate `WHERE assetId IN (…)` metadata/price read. The native
    // asset is a holding row too, so it needs no special append.
    const holdings = await getAccountHoldingsPage({
        accountAddress: address,
        scope,
        ...filters,
    })

    return { holdings }
}

type HoldingsSummary = {
    assetBalances: AssetWithAccountBalance[]
    nativeValue: Decimal
    usdValue: Decimal
    hasUnconvertible: boolean
    isNativeUnpriced: boolean
}

/**
 * One account's holdings on one chain as display-unit balances, with their
 * totals in that chain's native asset and in USD.
 */
export const summarizeHoldings = (
    holdings: AccountHoldingsPageRow[],
    chainId: ChainId,
): HoldingsSummary => {
    const nativeAsset = nativeAssetFor(chainId)
    // The native asset is itself a holding row; its joined price is the
    // rate used to express every holding's value in native terms.
    const nativeHolding = holdings.find(h => h.assetId === nativeAsset.assetId)
    const nativeUsdPrice = nativeHolding?.usdPrice ?? new Decimal(0)

    let nativeValue = new Decimal(0)
    let hasUnconvertible = false
    // Accumulated in the same pass as `nativeValue`: the portfolio
    // roll-up used to re-walk every account's holdings to derive this,
    // doubling the accounts×holdings Decimal work on every price poll.
    let usdValue = new Decimal(0)
    const assetBalances: AssetWithAccountBalance[] = holdings.map(holding => {
        const isNative = holding.assetId === nativeAsset.assetId
        const { restriction } = describeHolding(chainId, holding.native)
        // Native asset metadata is seeded, but fall back defensively
        // so the native balance always renders even mid-sync.
        const asset = holding.asset ?? (isNative ? nativeAsset : null)
        // Without asset metadata we can't scale base units to
        // display units, so emit zeros until the metadata syncs —
        // otherwise the sort-by-value key is inflated by 10^decimals.
        if (!asset) {
            return {
                assetId: holding.assetId,
                asset: undefined,
                amount: new Decimal(0),
                nativeValue: null,
                usdPrice: holding.usdPrice ?? undefined,
                fiatValue: null,
                restriction,
            }
        }
        const usdAssetPrice = holding.usdPrice ?? new Decimal(0)
        const assetAmount = holding.amount.div(pow10(asset.decimals))
        // The native asset's value in native terms is just its amount
        // (1:1), independent of price. Others convert via its rate,
        // and are unknown while either price is.
        const nativeAssetValueOf = () => {
            if (isNative) return assetAmount
            if (nativeUsdPrice.isZero() || holding.usdPrice === null) {
                return null
            }
            return assetAmount.times(usdAssetPrice).div(nativeUsdPrice)
        }
        const nativeAssetValue = nativeAssetValueOf()
        if (nativeAssetValue) {
            nativeValue = nativeValue.plus(nativeAssetValue)
        } else if (!usdAssetPrice.isZero()) {
            hasUnconvertible = true
        }
        usdValue = usdValue.plus(assetAmount.times(usdAssetPrice))
        return {
            assetId: holding.assetId,
            asset,
            amount: assetAmount,
            nativeValue: nativeAssetValue,
            usdPrice: usdAssetPrice,
            fiatValue:
                holding.usdPrice === null
                    ? null
                    : assetAmount.times(holding.usdPrice),
            restriction,
        }
    })

    const isNativeUnpriced =
        !!nativeHolding &&
        nativeHolding.usdPrice === null &&
        !nativeHolding.amount.isZero()

    return {
        assetBalances,
        nativeValue,
        usdValue,
        hasUnconvertible,
        isNativeUnpriced,
    }
}

export const useAccountBalancesQuery = (
    accounts: WalletAccount[],
    scope: ChainScope,
    enabled?: boolean,
    filters?: AccountHoldingsFilters,
): AccountBalancesWithTotals => {
    const nativeAsset = nativeAssetFor(scope.chainId)
    const hasAccounts = !!accounts?.length

    // Call sites routinely pass a fresh array literal (`[account]`) per
    // render. Only addresses are read below, so key the memos on this stable
    // list instead of array identity — otherwise every render of every such
    // call site re-walks all holdings, a Decimal per field per asset.
    const addresses = useStableIdList(
        accounts?.flatMap(
            a => chainAccountOf(a, scope.chainId)?.address ?? [],
        ) ?? [],
    )

    // See `valueAccountTotals`: single-chain wallets keep today's figures.
    const isUnconvertibleUnknown =
        useOtherRegisteredChainIds(scope.chainId).length > 0

    const queries = useMemo(() => {
        return addresses.map(address => {
            return {
                queryKey: getAccountBalancesQueryKey(address, scope, filters),
                enabled: !!address && enabled,
                staleTime: Infinity,
                gcTime: HOLDINGS_ROWS_GC_TIME_MS,
                // SQLite is the source of truth; run the queryFn even while offline
                // instead of pausing it (TanStack's default networkMode: 'online'),
                // which would strand consumers in `pending`. Network segments are
                // already caught in the syncer.
                networkMode: 'always' as const,
                // notifyOnChangeProps: 'all' disables Proxy-based property tracking in
                // TanStack Query. This works around a race condition in QueriesObserver
                // where _observerMatches and _result can get out of sync during
                // synchronous notifications, causing "new Proxy target must be an Object".
                notifyOnChangeProps: 'all' as const,
                queryFn: () => readAccountFromDb(address, scope, filters),
            }
        })
        // filters is a stable object passed from a Zustand selector or memoized
        // by the caller; deep equality is enforced via getAccountBalancesQueryKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        addresses,
        enabled,
        scope,
        filters?.hideZeroBalance,
        filters?.hideNfts,
        filters?.hideZeroBalanceNfts,
    ])

    const results = useQueries({ queries })

    // `useQueries` returns a fresh `results` array on every render even when
    // nothing changed, so depending on it directly defeats the memo below and
    // re-walks every holding — allocating a Decimal per field, per asset, per
    // render. This primitive signature captures everything the body reads
    // (`dataUpdatedAt` moves whenever the data does), and Object.is stays true
    // across renders when content matches. Same guard as `useLedgerDelegatedScan`.
    const resultsSig = results
        .map(
            (r, i) =>
                `${addresses[i] ?? ''}|${r.dataUpdatedAt}|${
                    r.isPending ? 1 : 0
                }${r.isFetched ? 1 : 0}${r.isRefetching ? 1 : 0}${
                    r.isError ? 1 : 0
                }${r.isPaused ? 1 : 0}`,
        )
        .join('||')

    const {
        accountBalances,
        portfolioNativeValue,
        isPending,
        isFetched,
        isRefetching,
        isError,
        isPaused,
    } = useMemo(() => {
        if (!hasAccounts) {
            return {
                accountBalances: new Map() as AccountBalances,
                portfolioNativeValue: new Decimal(0),
                isPending: false,
                isFetched: false,
                isRefetching: false,
                isError: false,
                isPaused: false,
            }
        }

        const accountBalanceList = results.map(r => {
            const {
                assetBalances,
                nativeValue,
                usdValue,
                hasUnconvertible,
                isNativeUnpriced,
            } = summarizeHoldings(r.data?.holdings ?? [], scope.chainId)

            return {
                assetBalances,
                nativeValue:
                    isUnconvertibleUnknown && hasUnconvertible
                        ? null
                        : nativeValue,
                usdValue,
                fiatValue: isNativeUnpriced ? null : usdValue,
                isPending: r.isPending,
                isFetched: r.isFetched,
                isRefetching: r.isRefetching,
                isError: r.isError,
            }
        })

        const accountBalances: AccountBalances = new Map(
            addresses.map((address, i) => [address, accountBalanceList[i]]),
        )

        const portfolioNativeValue = accountBalanceList.reduce<
            Nullable<Decimal>
        >(
            (acc, cur) =>
                acc === null || cur.nativeValue === null
                    ? null
                    : acc.plus(cur.nativeValue),
            new Decimal(0),
        )

        const isPending = results.some(r => r.isPending)
        const isFetched = results.every(r => r.isFetched)
        const isRefetching = results.some(r => r.isRefetching)
        const isError = results.some(r => r.isError)
        const isPaused = results.some(r => r.isPaused)

        return {
            accountBalances: isPending ? new Map() : accountBalances,
            portfolioNativeValue,
            isPending,
            isFetched,
            isRefetching,
            isError,
            isPaused,
        }
        // `results` is read inside but deliberately not a dep — `resultsSig`
        // is its stable stand-in; see the comment where it is built.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        resultsSig,
        addresses,
        hasAccounts,
        nativeAsset,
        scope.chainId,
        isUnconvertibleUnknown,
    ])

    return {
        accountBalances,
        portfolioNativeValue,
        isPending,
        isFetched,
        isRefetching,
        isError,
        isPaused,
    }
}

export type ChainAssetBalance = AssetWithAccountBalance & {
    /** The chain the holding is on, at that chain's selected network. */
    scope: ChainScope
}

export type UseAccountHoldingsAcrossChainsQueryResult = {
    assetBalances: ChainAssetBalance[]
    isPending: boolean
}

/**
 * Every holding the account has, on each registered chain it has an address
 * on. Each chain is read under `useAccountBalancesQuery`'s query key, so the
 * two share their cache.
 */
export const useAccountHoldingsAcrossChainsQuery = (
    account: Maybe<WalletAccount>,
): UseAccountHoldingsAcrossChainsQueryResult => {
    const registeredChainIds = useRegisteredChainIds()
    // A primitive, so only a network switch re-keys the reads.
    const networksKey = useNetworkStore(state =>
        registeredChainIds
            .map(
                chainId => `${chainId}:${selectChainNetworkId(state, chainId)}`,
            )
            .join(),
    )
    const heldOn = useStableIdList(
        account
            ? registeredChainIds.flatMap(chainId => {
                  const address = chainAccountOf(account, chainId)?.address
                  return address ? [`${chainId}|${address}`] : []
              })
            : [],
    )

    const entries = useMemo(() => {
        const networks = useNetworkStore.getState()
        return heldOn.map(id => {
            const [chainId, address] = id.split('|') as [ChainId, string]
            return {
                address,
                scope: {
                    chainId,
                    networkId: selectChainNetworkId(networks, chainId),
                },
            }
        })
        // `networksKey` stands in for the network store read above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [heldOn, networksKey])

    const results = useQueries({
        queries: entries.map(({ address, scope }) => ({
            queryKey: getAccountBalancesQueryKey(address, scope),
            staleTime: Infinity,
            gcTime: HOLDINGS_ROWS_GC_TIME_MS,
            networkMode: 'always' as const,
            notifyOnChangeProps: 'all' as const,
            queryFn: () => readAccountFromDb(address, scope),
        })),
    })

    const resultsSig = results
        .map(
            (r, i) =>
                `${heldOn[i] ?? ''}|${r.dataUpdatedAt}|${r.isPending ? 1 : 0}`,
        )
        .join('||')

    return useMemo(
        () => ({
            assetBalances: results.flatMap((r, i) => {
                const scope = entries[i]?.scope
                return scope
                    ? summarizeHoldings(
                          r.data?.holdings ?? [],
                          scope.chainId,
                      ).assetBalances.map(balance => ({ ...balance, scope }))
                    : []
            }),
            isPending: results.some(r => r.isPending),
        }),
        // `resultsSig` is the stable stand-in for `results`; see
        // useAccountBalancesQuery.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [resultsSig, entries],
    )
}

export const useAccountAssetBalanceQuery = (
    account: Optional<WalletAccount>,
    assetId: Optional<string>,
    scope: ChainScope,
) => {
    const {
        accountBalances,
        isPending,
        isFetched,
        isRefetching,
        isError,
        isPaused,
    } = useAccountBalancesQuery(
        account ? [account] : [],
        scope,
        !!account && assetId !== null && assetId !== undefined,
    )
    const address = account
        ? chainAccountOf(account, scope.chainId)?.address
        : undefined

    const assetBalance = useMemo<Nullable<AssetWithAccountBalance>>(() => {
        return (
            accountBalances
                ?.get(address ?? '')
                ?.assetBalances?.find(
                    (b: AssetWithAccountBalance) => b.assetId === assetId,
                ) ?? null
        )
    }, [accountBalances, address, assetId])

    return {
        data: assetBalance,
        isPending,
        isFetched,
        isRefetching,
        isError,
        isPaused,
    }
}
