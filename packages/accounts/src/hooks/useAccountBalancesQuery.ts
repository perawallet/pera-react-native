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
import { type Network } from '@perawallet/wallet-core-shared' // This might need to be migrated too or imported from core
import type {
    AccountAssetBalanceResponse,
    AccountBalances,
    AccountBalancesWithTotals,
    AssetWithAccountBalance,
    WalletAccount,
} from '../models'
import { fetchAccountBalances } from './endpoints'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'

export const getAccountBalancesQueryKey = (
    address: string,
    network: Network,
) => {
    return ['v1', 'accounts', 'assets', address, network]
}

//TODO optimize this to use the combine option
export const useAccountBalancesQuery = (
    accounts: WalletAccount[],
    enabled?: boolean,
): AccountBalancesWithTotals => {
    const { usdToPreferred } = useCurrency()
    const { network } = useNetwork()
    if (!accounts?.length) {
        return {
            accountBalances: new Map(),
            portfolioAlgoBalance: new Decimal(0),
            portfolioFiatBalance: new Decimal(0),
            isPending: false,
            isFetched: false,
            isRefetching: false,
            isError: false,
        }
    }
    const results = useQueries({
        queries: accounts.map(acc => {
            const address = acc.address
            return {
                queryKey: getAccountBalancesQueryKey(address, network),
                enabled: enabled,
                queryFn: () => fetchAccountBalances(address, network),
            }
        }),
    })

    const {
        accountBalances,
        portfolioAlgoBalance,
        portfolioFiatBalance,
        isPending,
        isFetched,
        isRefetching,
        isError,
    } = useMemo(() => {
        const accountBalanceList = results.map(r => {
            let algoAmount = new Decimal(0)
            let fiatAmount = new Decimal(0)

            const assetBalances: AssetWithAccountBalance[] = []

            r.data?.results?.forEach((asset: AccountAssetBalanceResponse) => {
                algoAmount = algoAmount.plus(
                    new Decimal(asset.amount ?? '0').div(
                        new Decimal(10).pow(asset.fraction_decimals),
                    ),
                )
                fiatAmount = fiatAmount.plus(
                    new Decimal(asset.balance_usd_value ?? '0'),
                )
                assetBalances.push({
                    assetId: `${asset.asset_id}`,
                    cryptoAmount: new Decimal(asset.amount ?? '0'),
                    fiatAmount: usdToPreferred(
                        new Decimal(asset.balance_usd_value ?? '0'),
                    ),
                })
            })

            // Handle the case where the backend/blockchain doesn't know this account yet
            if (!assetBalances.length) {
                assetBalances.push({
                    assetId: ALGO_ASSET_ID,
                    cryptoAmount: algoAmount,
                    fiatAmount: usdToPreferred(fiatAmount),
                })
            }

            return {
                assetBalances,
                algoBalance: algoAmount,
                fiatBalance: usdToPreferred(fiatAmount),
                isPending: r.isPending,
                isFetched: r.isFetched,
                isRefetching: r.isRefetching,
                isError: r.isError,
            }
        })

        const accountBalances: AccountBalances = new Map(
            accounts.map((a, i) => [a.address, accountBalanceList[i]]),
        )

        const portfolioAlgoBalance = accountBalanceList.reduce(
            (acc, cur) => acc.plus(cur.algoBalance),
            Decimal(0),
        )
        const portfolioFiatBalance = accountBalanceList.reduce(
            (acc, cur) => acc.plus(cur.fiatBalance),
            Decimal(0),
        )

        return {
            accountBalances,
            portfolioAlgoBalance,
            portfolioFiatBalance,
            isPending: results.some(r => r.isPending),
            isFetched: results.every(r => r.isFetched),
            isRefetching: results.some(r => r.isRefetching),
            isError: results.some(r => r.isError),
        }
    }, [results, accounts, usdToPreferred])

    return {
        accountBalances,
        portfolioAlgoBalance,
        portfolioFiatBalance,
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
