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
import Decimal from 'decimal.js'
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
    toWholeUnits,
    useAssetPricesQuery,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { getAccountBalancesQueryKey } from './querykeys'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'

//TODO we may not need this query - maybe we should just fetch each account separately
export const useAccountBalancesQuery = (
    accounts: WalletAccount[],
    enabled?: boolean,
): AccountBalancesWithTotals => {
    const { network } = useNetwork()
    const algokit = useAlgorandClient()
    if (!accounts?.length) {
        return {
            accountBalances: new Map(),
            portfolioAlgoValue: Decimal(0),
            isPending: false,
            isFetched: false,
            isRefetching: false,
            isError: false,
        }
    }

    const queries = useMemo(() => {
        return accounts.map(acc => {
            const address = acc.address
            return {
                queryKey: getAccountBalancesQueryKey(address, network),
                enabled: !!address && enabled,
                queryFn: () => algokit.account.getInformation(address),
            }
        })
    }, [accounts, enabled, network])

    const results = useQueries({
        queries: queries,
    })

    const assetIDs = results.flatMap(
        r => r.data?.assets?.map(a => `${a.assetId}`) ?? [],
    )
    const { data: assets } = useAssetsQuery(assetIDs)
    const { data: assetPrices } = useAssetPricesQuery(assetIDs)
    const usdAlgoPrice = useMemo(
        () => assetPrices?.get(ALGO_ASSET_ID)?.usdPrice ?? Decimal(0),
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
        const accountBalanceList = results.map(r => {
            let algoValue = Decimal(0)

            const assetBalances: AssetWithAccountBalance[] = []
            r.data?.assets?.forEach(assetHolding => {
                const usdAssetPrice =
                    assetPrices?.get(`${assetHolding.assetId}`)?.usdPrice ??
                    Decimal(0)
                const asset = assets.get(`${assetHolding.assetId}`)
                const assetAmount = Decimal(assetHolding.amount ?? '0').div(
                    Decimal(10).pow(asset?.decimals ?? 0),
                )
                const usdAssetValue = assetAmount.times(usdAssetPrice)
                const algoAssetValue = usdAlgoPrice.isZero()
                    ? Decimal(0)
                    : usdAssetValue.div(usdAlgoPrice)
                algoValue = algoValue.plus(algoAssetValue)
                assetBalances.push({
                    assetId: `${assetHolding.assetId}`,
                    amount: assetAmount,
                    algoValue: algoAssetValue,
                })
            })

            //Now add algo into the mix
            const algoAmount = toWholeUnits(
                r.data?.balance?.microAlgos ?? 0n,
                ALGO_ASSET,
            )
            algoValue = algoValue.plus(algoAmount)

            assetBalances.push({
                assetId: ALGO_ASSET_ID,
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
            Decimal(0),
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
    }, [results, accounts, assets, assetPrices])

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
            !!account && assetId != null,
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
