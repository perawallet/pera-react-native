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
import { getAccountBalance, getAccountHoldings } from '../db'

type AccountDbSnapshot = {
    algoBalance: Decimal
    holdings: Array<{ assetId: string; amount: Decimal }>
}

async function readAccountFromDb(
    address: string,
    network: string,
): Promise<AccountDbSnapshot> {
    const balance = await getAccountBalance({
        accountAddress: address,
        network,
    })
    const holdings = await getAccountHoldings({
        accountAddress: address,
        network,
    })

    return {
        algoBalance: balance?.algoBalance ?? new Decimal(0),
        holdings,
    }
}

export const useAccountBalancesQuery = (
    accounts: WalletAccount[],
    enabled?: boolean,
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
                queryKey: getAccountBalancesQueryKey(address, network),
                enabled: !!address && enabled,
                staleTime: Infinity,
                queryFn: () => readAccountFromDb(address, network),
            }
        })
    }, [accounts, hasAccounts, enabled, network])

    // notifyOnChangeProps: 'all' disables Proxy-based property tracking in TanStack Query.
    // This works around a race condition in QueriesObserver where _observerMatches and _result
    // can get out of sync during synchronous notifications, causing "new Proxy target must be an Object".
    const results = useQueries({
        queries: queries.map(q => ({
            ...q,
            notifyOnChangeProps: 'all' as const,
        })),
    })

    const assetIDs = results.flatMap(
        r => r.data?.holdings?.map(h => h.assetId) ?? [],
    )
    const { data: assets } = useAssetsQuery(assetIDs)
    const { data: assetPrices } = useAssetPricesQuery(assetIDs)
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
    }, [results, accounts, hasAccounts, assets, assetPrices])

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

    const assetBalance = useMemo<AssetWithAccountBalance | null>(() => {
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
