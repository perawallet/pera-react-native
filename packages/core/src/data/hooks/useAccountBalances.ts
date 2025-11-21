import type {
    AccountBalances,
    AssetWithAccountBalance,
} from '../../data/types/AccountBalances'
import {
    v1AccountsAssetsList,
    v1AccountsAssetsListQueryKey,
    type AccountDetailAssetSerializerResponse,
} from '../../api/index'
import type { WalletAccount } from '../../services/accounts'
import { useCurrencyConverter } from '../../services/currencies'
import { useQueries } from '@tanstack/react-query'
import Decimal from 'decimal.js'
import { useMemo } from 'react'

export const useAccountBalances = (
    accounts: WalletAccount[],
    enabled?: boolean,
) => {
    const { usdToPreferred } = useCurrencyConverter()
    if (!accounts?.length) {
        return {
            data: new Map(),
            loading: false,
            totalAlgoBalance: Decimal(0),
            totalFiatBalance: Decimal(0),
        }
    }
    const results = useQueries({
        queries: accounts.map(acc => {
            const address = acc.address
            return {
                queryKey: v1AccountsAssetsListQueryKey(
                    { account_address: address },
                    { include_algo: true },
                ),
                enabled: enabled,
                queryFn: () =>
                    v1AccountsAssetsList({
                        account_address: address,
                        params: { include_algo: true },
                    }),
            }
        }),
    })

    const data = useMemo<AccountBalances>(() => {
        const accountBalanceList = results.map(r => {
            let algoAmount = Decimal(0)
            let fiatAmount = Decimal(0)

            const assetBalances: AccountDetailAssetSerializerResponse[] = []

            r.data?.results?.forEach(
                (asset: AccountDetailAssetSerializerResponse) => {
                    algoAmount = algoAmount.plus(
                        Decimal(asset.amount ?? '0').div(
                            Decimal(10).pow(asset.fraction_decimals),
                        ),
                    )
                    fiatAmount = fiatAmount.plus(
                        Decimal(asset.balance_usd_value ?? '0'),
                    )
                    assetBalances.push(asset)
                },
            )

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
    }, [results, accounts])

    const loading = useMemo(
        () => [...data?.values()].some(d => !d.isFetched),
        [data],
    )
    const totalAlgoBalance = useMemo(
        () =>
            [...data?.values()].reduce(
                (acc, cur) => acc.plus(cur.algoBalance),
                Decimal(0),
            ),
        [data],
    )
    const totalFiatBalance = useMemo(
        () =>
            [...data?.values()].reduce(
                (acc, cur) => acc.plus(cur.fiatBalance),
                Decimal(0),
            ),
        [data],
    )

    return {
        data,
        loading,
        totalAlgoBalance,
        totalFiatBalance,
    }
}

export const useAccountAssetBalance = (
    account?: WalletAccount,
    assetId?: number,
) => {
    const { data, loading } = useAccountBalances(
        account ? [account] : [],
        !!account && assetId != null,
    )

    const assetBalance = useMemo<AssetWithAccountBalance | null>(() => {
        return (
            data
                ?.get(account?.address)
                ?.assetBalances?.find(
                    (b: AssetWithAccountBalance) => b.asset_id === assetId,
                ) ?? null
        )
    }, [data, account?.address, assetId])

    return {
        data: assetBalance,
        isPending: loading,
    }
}
