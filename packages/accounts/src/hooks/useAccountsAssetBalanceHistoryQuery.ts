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

import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { HistoryPeriod } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '../models'
import { useQuery } from '@tanstack/react-query'
import { fetchAccountAssetBalanceHistory } from './endpoints'
import { Decimal } from 'decimal.js'
import { getAccountAssetBalanceHistoryQueryKey } from './querykeys'

export const useAccountsAssetsBalanceHistoryQuery = (
    account: WalletAccount,
    assetId: string,
    period: HistoryPeriod,
) => {
    const { network } = useNetwork()
    const { preferredCurrency, usdToPreferred } = useCurrency()

    return useQuery({
        queryKey: getAccountAssetBalanceHistoryQueryKey(
            network,
            account.address,
            assetId,
            period,
            preferredCurrency,
        ),
        queryFn: () =>
            fetchAccountAssetBalanceHistory(
                account.address,
                assetId,
                period,
                preferredCurrency,
                network,
            ),
        // `data` / `data.results` can be absent when the endpoint answers with
        // an empty or 204 body (the fetch layer yields `undefined` for those).
        // Guard so a not-ready response collapses to an empty chart instead of
        // throwing and surfacing as a query error.
        select: data =>
            data?.results?.map(item => ({
                datetime: new Date(item.datetime),
                amount: new Decimal(item.amount ?? '0'),
                preferredValue: usdToPreferred(
                    new Decimal(item.usd_value ?? '0'),
                ),
                round: item.round,
            })) ?? [],
    })
}
