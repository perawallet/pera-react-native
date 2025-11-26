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

    const data = useMemo<AccountBalances>(() => {
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
        return accountBalances
    }, [results, accounts, usdToPreferred])

    const portfolioAlgoBalance = useMemo(
        () =>
            [...(data ? data.values() : [])].reduce(
                (acc, cur) => acc.plus(cur.algoBalance),
                new Decimal(0),
            ),
        [data],
    )
    const portfolioFiatBalance = useMemo(
        () =>
            [...(data ? data.values() : [])].reduce(
                (acc, cur) => acc.plus(cur.fiatBalance),
                new Decimal(0),
            ),
        [data],
    )

    const isPending = useMemo(
        () => [...(data ? data.values() : [])].some(d => d.isPending),
        [data],
    )
    const isFetched = useMemo(
        () => [...(data ? data.values() : [])].some(d => d.isFetched),
        [data],
    )
    const isRefetching = useMemo(
        () => [...(data ? data.values() : [])].some(d => d.isRefetching),
        [data],
    )
    const isError = useMemo(
        () => [...(data ? data.values() : [])].some(d => d.isError),
        [data],
    )

    return {
        accountBalances: data,
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
