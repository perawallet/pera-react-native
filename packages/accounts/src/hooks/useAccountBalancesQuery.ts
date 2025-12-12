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
    useAssetFiatPricesQuery,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { getAccountBalancesQueryKey } from './querykeys'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'

//TODO we may not need this query - maybe we should just fetch each account separately
export const useAccountBalancesQuery = (
    accounts: WalletAccount[],
    enabled?: boolean,
): AccountBalancesWithTotals => {
    const { usdToPreferred } = useCurrency()
    const { network } = useNetwork()
    const algokit = useAlgorandClient()
    if (!accounts?.length) {
        return {
            accountBalances: new Map(),
            portfolioAlgoValue: Decimal(0),
            portfolioFiatValue: Decimal(0),
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

    const { data: assets } = useAssetsQuery(
        results.flatMap(
            r => r.data?.assets?.map(a => `${a.assetId}`) ?? [],
        ),
    )
    const { data: assetPrices } = useAssetFiatPricesQuery()
    const usdAlgoPrice = useMemo(
        () => assetPrices?.get(ALGO_ASSET_ID)?.fiatPrice ?? Decimal(0),
        [assetPrices],
    )

    const {
        accountBalances,
        portfolioAlgoValue,
        portfolioFiatValue,
        isPending,
        isFetched,
        isRefetching,
        isError,
    } = useMemo(() => {
        const accountBalanceList = results.map(r => {
            let algoValue = Decimal(0)
            let fiatValue = Decimal(0)

            const assetBalances: AssetWithAccountBalance[] = []
            r.data?.assets?.forEach((assetHolding: AssetHolding) => {
                const usdAssetPrice =
                    assetPrices?.get(`${assetHolding['asset-id']}`)
                        ?.fiatPrice ?? Decimal(0)
                const asset = assets.get(`${assetHolding['asset-id']}`)
                const assetAmount = Decimal(assetHolding.amount ?? '0').div(
                    Decimal(10).pow(asset?.decimals ?? 0),
                )
                const usdAssetValue = assetAmount.times(usdAssetPrice)
                const algoAssetValue = usdAssetPrice.isZero()
                    ? Decimal(0)
                    : usdAssetValue.div(usdAlgoPrice)
                const fiatAssetValue = usdToPreferred(usdAssetValue)
                algoValue = algoValue.plus(algoAssetValue)
                fiatValue = fiatValue.plus(fiatAssetValue)
                assetBalances.push({
                    assetId: `${assetHolding['asset-id']}`,
                    amount: assetAmount,
                    algoValue: algoAssetValue,
                    fiatValue: fiatAssetValue,
                })
            })

            //Now add algo into the mix
            const algoAmount = Decimal(r.data?.amount ?? '0').div(
                Decimal(10).pow(ALGO_ASSET.decimals),
            )
            const usdAlgoValue = algoAmount.times(usdAlgoPrice)
            const fiatAlgoValue = usdToPreferred(usdAlgoValue)
            algoValue = algoValue.plus(usdAlgoValue)
            fiatValue = fiatValue.plus(fiatAlgoValue)

            assetBalances.push({
                assetId: ALGO_ASSET_ID,
                amount: algoAmount,
                algoValue: algoAmount,
                fiatValue: fiatAlgoValue,
            })

            return {
                assetBalances,
                algoValue,
                fiatValue,
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
        const portfolioFiatValue = accountBalanceList.reduce(
            (acc, cur) => acc.plus(cur.fiatValue),
            Decimal(0),
        )

        return {
            accountBalances,
            portfolioAlgoValue,
            portfolioFiatValue,
            isPending: results.some(r => r.isPending),
            isFetched: results.every(r => r.isFetched),
            isRefetching: results.some(r => r.isRefetching),
            isError: results.some(r => r.isError),
        }
    }, [results, accounts, usdToPreferred, assets, assetPrices])

    return {
        accountBalances,
        portfolioAlgoValue,
        portfolioFiatValue,
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
