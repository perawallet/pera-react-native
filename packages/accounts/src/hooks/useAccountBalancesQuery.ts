/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    AccountBalances,
    AccountBalancesWithTotals,
    AssetWithAccountBalance,
    WalletAccount,
} from '../models'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    useAssetPricesQuery,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAccountBalancesQueryKey } from './querykeys'
import {
    getAccountBalance,
    getAccountHoldings,
    type AccountHoldingsFilters,
} from '../db'
import { fetchAndPersistAccount } from '../sync/account-syncer'

type AccountDbSnapshot = {
    algoBalance: Decimal
    holdings: Array<{ assetId: string; amount: Decimal }>
}

async function readAccountFromDb(
    address: string,
    network: string,
    filters?: AccountHoldingsFilters,
): Promise<AccountDbSnapshot> {
    // If this account has no balance row yet the background sync either
    // hasn't run or silently failed. Pull directly from the chain before
    // reading so the UI recovers without waiting for the next poll cycle.
    let balance = await getAccountBalance({
        accountAddress: address,
        network,
    })
    if (!balance) {
        try {
            await fetchAndPersistAccount(address, network as Network)
            balance = await getAccountBalance({
                accountAddress: address,
                network,
            })
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

    const holdings = await getAccountHoldings({
        accountAddress: address,
        network,
        ...filters,
    })

    return {
        algoBalance: balance?.algoBalance ?? new Decimal(0),
        holdings,
    }
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

    // notifyOnChangeProps: 'all' disables Proxy-based property tracking in TanStack Query.
    // This works around a race condition in QueriesObserver where _observerMatches and _result
    // can get out of sync during synchronous notifications, causing "new Proxy target must be an Object".
    const results = useQueries({
        queries: queries.map(q => ({
            ...q,
            notifyOnChangeProps: 'all' as const,
        })),
    })

    // Always include ALGO in the prices query — holdings never contain ALGO,
    // but we need its USD price to express per-asset and portfolio totals in
    // ALGO-denominated terms.
    const assetIDs = results.flatMap(
        r => r.data?.holdings?.map(h => h.assetId) ?? [],
    )
    const { data: assets } = useAssetsQuery(assetIDs)
    const { data: assetPrices } = useAssetPricesQuery([
        ALGO_ASSET_ID,
        ...assetIDs,
    ])
    const usdAlgoPrice = useMemo(
        () => assetPrices?.get(ALGO_ASSET_ID)?.usdPrice ?? new Decimal(0),
        [assetPrices],
    )

    const {
        accountBalances,
        portfolioAlgoValue,
        isPending,
        isFetched,
        isRefetching,
        isError,
    } = useMemo(() => {
        if (!hasAccounts) {
            return {
                accountBalances: new Map() as AccountBalances,
                portfolioAlgoValue: new Decimal(0),
                isPending: false,
                isFetched: false,
                isRefetching: false,
                isError: false,
            }
        }

        const accountBalanceList = results.map(r => {
            let algoValue = new Decimal(0)

            const assetBalances: AssetWithAccountBalance[] = []
            r.data?.holdings?.forEach(holding => {
                const usdAssetPrice =
                    assetPrices?.get(holding.assetId)?.usdPrice ??
                    new Decimal(0)
                const asset = assets.get(holding.assetId)
                const assetAmount = holding.amount.div(
                    new Decimal(10).pow(asset?.decimals ?? 0),
                )
                const usdAssetValue = assetAmount.times(usdAssetPrice)
                const algoAssetValue = usdAlgoPrice.isZero()
                    ? new Decimal(0)
                    : usdAssetValue.div(usdAlgoPrice)
                algoValue = algoValue.plus(algoAssetValue)
                assetBalances.push({
                    assetId: holding.assetId,
                    asset: asset,
                    amount: assetAmount,
                    algoValue: algoAssetValue,
                })
            })

            //Now add algo into the mix
            const algoAmount = r.data?.algoBalance ?? new Decimal(0)
            algoValue = algoValue.plus(algoAmount)

            assetBalances.push({
                assetId: ALGO_ASSET_ID,
                asset: ALGO_ASSET,
                amount: algoAmount,
                algoValue: algoAmount,
            })

            return {
                assetBalances,
                algoValue,
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

        return {
            accountBalances: isPending ? new Map() : accountBalances,
            portfolioAlgoValue,
            isPending,
            isFetched,
            isRefetching,
            isError,
        }
    }, [results, accounts, hasAccounts, assets, assetPrices, usdAlgoPrice])

    return {
        accountBalances,
        portfolioAlgoValue,
        isPending,
        isFetched,
        isRefetching,
        isError,
    }
}

export const useAccountAssetBalanceQuery = (
    account?: WalletAccount,
    assetId?: string,
) => {
    const { accountBalances, isPending, isFetched, isRefetching, isError } =
        useAccountBalancesQuery(
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
    }
}
