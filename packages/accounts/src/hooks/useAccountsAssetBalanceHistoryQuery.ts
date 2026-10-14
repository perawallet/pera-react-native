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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { HistoryPeriod, Nullable } from '@perawallet/wallet-core-shared'
import type { AccountAssetBalanceHistoryItem, WalletAccount } from '../models'
import { chainAccountOf } from '../credentials/accessors'
import { useQuery, type RefetchOptions } from '@tanstack/react-query'
import { fetchHoldingBalanceHistory } from '../chain-adapter'
import { getAccountAssetBalanceHistoryQueryKey } from './querykeys'

export type UseAccountsAssetsBalanceHistoryQueryResult = {
    data: AccountAssetBalanceHistoryItem[]
    isPending: boolean
    isSuccess: boolean
    isError: boolean
    isPaused: boolean
    error: Nullable<Error>
    /** True when the chain has no holding history source — this can never succeed here. */
    isUnavailableOnNetwork: boolean
    refetch: (options?: RefetchOptions) => unknown
}

export const useAccountsAssetsBalanceHistoryQuery = (
    account: WalletAccount,
    assetId: string,
    period: HistoryPeriod,
    scope: ChainScope,
): UseAccountsAssetsBalanceHistoryQueryResult => {
    const address = chainAccountOf(account, scope.chainId)?.address ?? ''
    const { preferredCurrency, usdToPreferred } = useCurrency()
    const isUnavailableOnNetwork = !useChainCapability(
        scope.chainId,
        'balanceHistory',
    )

    const query = useQuery({
        queryKey: getAccountAssetBalanceHistoryQueryKey(
            scope,
            address,
            assetId,
            period,
            preferredCurrency,
        ),
        enabled: !isUnavailableOnNetwork,
        queryFn: () =>
            fetchHoldingBalanceHistory(
                address,
                assetId,
                period,
                preferredCurrency,
                scope,
            ),
        select: points =>
            points.map(point => ({
                datetime: new Date(point.timestamp),
                amount: point.amount,
                preferredValue: usdToPreferred(point.usdValue),
            })),
    })

    return {
        data: query.data ?? [],
        isPending: isUnavailableOnNetwork ? false : query.isPending,
        isSuccess: query.isSuccess,
        isError: query.isError,
        isPaused: query.isPaused,
        error: query.error,
        isUnavailableOnNetwork,
        // The observer's refetch() ignores `enabled` and would still fire the
        // doomed request on a chain without the source.
        refetch: (options?: RefetchOptions) =>
            isUnavailableOnNetwork
                ? Promise.resolve(query)
                : query.refetch(options),
    }
}
