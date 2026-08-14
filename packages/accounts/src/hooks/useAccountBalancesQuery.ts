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
import {
    isAlgoAssetId,
    logger,
    pow10,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    AccountBalances,
    AccountBalancesWithTotals,
    AssetWithAccountBalance,
    WalletAccount,
} from '../models'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAccountBalancesQueryKey } from './querykeys'
import {
    getAccountBalance,
    getAccountHoldingsPage,
    type AccountHoldingsFilters,
    type AccountHoldingsPageRow,
} from '../db'
import { fetchAndPersistAccount } from '../sync/account-syncer'

type AccountDbSnapshot = {
    holdings: AccountHoldingsPageRow[]
}

async function readAccountFromDb(
    address: string,
    network: string,
    filters?: AccountHoldingsFilters,
): Promise<AccountDbSnapshot> {
    // If this account has no balance row yet the background sync either
    // hasn't run or silently failed. Pull directly from the chain before
    // reading so the UI recovers without waiting for the next poll cycle.
    const balance = await getAccountBalance({
        accountAddress: address,
        network,
    })
    if (!balance) {
        try {
            await fetchAndPersistAccount(address, network as Network)
        } catch (error) {
            logger.warn('On-demand account fetch failed', {
                address,
                network,
                error:
                    error instanceof Error
                        ? { message: error.message, stack: error.stack }
                        : error,
            })
        }
    }

    // Single join read: each holding carries its asset metadata + USD price, so
    // there's no separate `WHERE assetId IN (…)` metadata/price read. ALGO is a
    // holding row too (base units, 6 decimals), so it needs no special append.
    const holdings = await getAccountHoldingsPage({
        accountAddress: address,
        network,
        ...filters,
    })

    return { holdings }
}

export const useAccountBalancesQuery = (
    accounts: WalletAccount[],
    enabled?: boolean,
    filters?: AccountHoldingsFilters,
): AccountBalancesWithTotals => {
    const { network } = useNetwork()
    const hasAccounts = !!accounts?.length

    const queries = useMemo(() => {
        if (!hasAccounts) {
            return []
        }
        return accounts.map(acc => {
            const address = acc.address
            return {
                queryKey: getAccountBalancesQueryKey(address, network, filters),
                enabled: !!address && enabled,
                staleTime: Infinity,
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
                queryFn: () => readAccountFromDb(address, network, filters),
            }
        })
        // filters is a stable object passed from a Zustand selector or memoized
        // by the caller; deep equality is enforced via getAccountBalancesQueryKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        accounts,
        hasAccounts,
        enabled,
        network,
        filters?.hideZeroBalance,
        filters?.hideNfts,
        filters?.hideOptedInNfts,
    ])

    const results = useQueries({ queries })

    // `useQueries` returns a fresh `results` array on every render even when
    // nothing changed, so depending on it directly defeats the memo below and
    // re-walks every holding — allocating a Decimal per field, per asset, per
    // render. This primitive signature captures everything the body reads
    // (`dataUpdatedAt` moves whenever the data does), and Object.is stays true
    // across renders when content matches. Same guard as `useLedgerRekeyedScan`.
    const resultsSig = results
        .map(
            (r, i) =>
                `${accounts[i]?.address ?? ''}|${r.dataUpdatedAt}|${
                    r.isPending ? 1 : 0
                }${r.isFetched ? 1 : 0}${r.isRefetching ? 1 : 0}${
                    r.isError ? 1 : 0
                }${r.isPaused ? 1 : 0}`,
        )
        .join('||')

    const {
        accountBalances,
        portfolioAlgoValue,
        isPending,
        isFetched,
        isRefetching,
        isError,
        isPaused,
    } = useMemo(() => {
        if (!hasAccounts) {
            return {
                accountBalances: new Map() as AccountBalances,
                portfolioAlgoValue: new Decimal(0),
                isPending: false,
                isFetched: false,
                isRefetching: false,
                isError: false,
                isPaused: false,
            }
        }

        const accountBalanceList = results.map(r => {
            const holdings = r.data?.holdings ?? []
            // ALGO is itself a holding row now; its joined price is the ALGO/USD
            // rate used to express every holding's value in ALGO terms.
            const usdAlgoPrice =
                holdings.find(h => isAlgoAssetId(h.assetId))?.usdPrice ??
                new Decimal(0)

            let algoValue = new Decimal(0)
            // Accumulated in the same pass as `algoValue`: `usePortfolioTotals`
            // used to re-walk every account's holdings to derive this, doubling
            // the accounts×holdings Decimal work on every price poll.
            let usdValue = new Decimal(0)
            const assetBalances: AssetWithAccountBalance[] = holdings.map(
                holding => {
                    const isAlgo = isAlgoAssetId(holding.assetId)
                    // ALGO metadata is seeded, but fall back defensively so the
                    // native balance always renders even mid-sync.
                    const asset = holding.asset ?? (isAlgo ? ALGO_ASSET : null)
                    // Without asset metadata we can't scale base units to
                    // display units, so emit zeros until the metadata syncs —
                    // otherwise the sort-by-value key is inflated by 10^decimals.
                    if (!asset) {
                        return {
                            assetId: holding.assetId,
                            asset: undefined,
                            amount: new Decimal(0),
                            algoValue: new Decimal(0),
                            usdPrice: holding.usdPrice ?? undefined,
                        }
                    }
                    const usdAssetPrice = holding.usdPrice ?? new Decimal(0)
                    const assetAmount = holding.amount.div(
                        pow10(asset.decimals),
                    )
                    // ALGO's value in ALGO terms is just its amount (1:1),
                    // independent of price. ASAs convert via the ALGO/USD rate.
                    const algoAssetValue = isAlgo
                        ? assetAmount
                        : usdAlgoPrice.isZero()
                          ? new Decimal(0)
                          : assetAmount.times(usdAssetPrice).div(usdAlgoPrice)
                    algoValue = algoValue.plus(algoAssetValue)
                    usdValue = usdValue.plus(assetAmount.times(usdAssetPrice))
                    return {
                        assetId: holding.assetId,
                        asset,
                        amount: assetAmount,
                        algoValue: algoAssetValue,
                        usdPrice: usdAssetPrice,
                    }
                },
            )

            return {
                assetBalances,
                algoValue,
                usdValue,
                isPending: r.isPending,
                isFetched: r.isFetched,
                isRefetching: r.isRefetching,
                isError: r.isError,
            }
        })

        const accountBalances: AccountBalances = new Map(
            accounts.map((a, i) => [a.address, accountBalanceList[i]]),
        )

        const portfolioAlgoValue = accountBalanceList.reduce(
            (acc, cur) => acc.plus(cur.algoValue),
            new Decimal(0),
        )

        const isPending = results.some(r => r.isPending)
        const isFetched = results.every(r => r.isFetched)
        const isRefetching = results.some(r => r.isRefetching)
        const isError = results.some(r => r.isError)
        const isPaused = results.some(r => r.isPaused)

        return {
            accountBalances: isPending ? new Map() : accountBalances,
            portfolioAlgoValue,
            isPending,
            isFetched,
            isRefetching,
            isError,
            isPaused,
        }
        // `results` is read inside but deliberately not a dep — `resultsSig` is
        // its stable stand-in; see the comment where it is built.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultsSig, accounts, hasAccounts])

    return {
        accountBalances,
        portfolioAlgoValue,
        isPending,
        isFetched,
        isRefetching,
        isError,
        isPaused,
    }
}

export const useAccountAssetBalanceQuery = (
    account?: WalletAccount,
    assetId?: string,
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
        !!account && assetId !== null && assetId !== undefined,
    )

    const assetBalance = useMemo<Nullable<AssetWithAccountBalance>>(() => {
        return (
            accountBalances
                ?.get(account?.address ?? '')
                ?.assetBalances?.find(
                    (b: AssetWithAccountBalance) => b.assetId === assetId,
                ) ?? null
        )
    }, [accountBalances, account?.address, assetId])

    return {
        data: assetBalance,
        isPending,
        isFetched,
        isRefetching,
        isError,
        isPaused,
    }
}
