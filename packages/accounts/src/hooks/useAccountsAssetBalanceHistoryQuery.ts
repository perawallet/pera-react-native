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

import { useCurrency } from "@perawallet/wallet-core-currencies"
import { useNetwork } from "@perawallet/wallet-core-platform-integration"
import type { HistoryPeriod, Network } from "@perawallet/wallet-core-shared"
import type { WalletAccount } from "../models"
import { useQuery } from "@tanstack/react-query"
import { fetchAccountAssetBalanceHistory } from "./endpoints"
import Decimal from "decimal.js"


export const getAccountAssetBalanceHistoryQueryKey = (
    network: Network,
    account_address: string,
    asset_id: string,
    period: HistoryPeriod,
    currency: string,
) => [
        'v1', 'accounts', account_address, 'assets', asset_id, 'balance-history', { period, currency, network }
    ]

export const useAccountsAssetsBalanceHistoryQuery = (account: WalletAccount, assetId: string, period: HistoryPeriod) => {
    const { network } = useNetwork()
    const { preferredCurrency, usdToPreferred } = useCurrency()

    return useQuery({
        queryKey: getAccountAssetBalanceHistoryQueryKey(network, account.address, assetId, period, preferredCurrency),
        queryFn: () => fetchAccountAssetBalanceHistory(account.address, assetId, period, preferredCurrency, network),
        select: (data) => {
            return data.results.map((item) => ({
                datetime: new Date(item.datetime),
                algoValue: Decimal(item.algo_value ?? '0'),
                fiatValue: usdToPreferred(Decimal(item.usd_value ?? '0')),
                round: item.round,
            }))
        }
    })
}
