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

import { useQuery, type RefetchOptions } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { HistoryPeriod, Nullable } from '@perawallet/wallet-core-shared'
import type { AccountAddress, AccountBalanceHistoryItem } from '../models'
import {
    fetchPortfolioHistory,
    type PortfolioHistoryPoint,
} from '../chain-adapter'
import { useCallback } from 'react'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { getAccountBalancesHistoryQueryKey } from './querykeys'

export type UseAccountBalancesHistoryQueryResult = {
    data: AccountBalanceHistoryItem[]
    isPending: boolean
    isSuccess: boolean
    isError: boolean
    isPaused: boolean
    error: Nullable<Error>
    /** True when the network has no portfolio history source — this can never succeed here. */
    isUnavailableOnNetwork: boolean
    refetch: (options?: RefetchOptions) => unknown
}

//TODO do we need to support pagination?
export const useAccountBalancesHistoryQuery = (
    addresses: AccountAddress[],
    period: HistoryPeriod,
    scope: ChainScope,
    enabled = true,
): UseAccountBalancesHistoryQueryResult => {
    const { usdToPreferred } = useCurrency(scope)
    const isCapabilityOff = !useChainCapability(scope.chainId, 'balanceHistory')
    const queryKey = getAccountBalancesHistoryQueryKey(addresses, period, scope)
    const isEnabled = enabled && addresses.length > 0 && !isCapabilityOff
    const query = useQuery({
        queryKey,
        // Gated by callers on chart visibility — this hits a slow network
        // endpoint and is only needed to render the wealth chart/trend.
        enabled: isEnabled,
        queryFn: () => fetchPortfolioHistory(addresses, period, scope),
        select: useCallback(
            (
                points: Nullable<PortfolioHistoryPoint[]>,
            ): Nullable<AccountBalanceHistoryItem[]> =>
                points?.map(point => ({
                    datetime: new Date(point.timestamp),
                    preferredValue: usdToPreferred(point.usdValue),
                    nativeValue: point.nativeValue,
                })) ?? null,
            [usdToPreferred],
        ),
    })
    const isUnavailableOnNetwork = isCapabilityOff || query.data === null

    return {
        // A disabled query keeps its cached (and persisted) points; drop them
        // so a kill switch takes the chart down.
        data: isUnavailableOnNetwork ? [] : (query.data ?? []),
        isPending: isEnabled && query.isPending,
        isSuccess: query.isSuccess,
        isError: query.isError,
        isPaused: query.isPaused,
        error: query.error,
        isUnavailableOnNetwork,
        // The observer's refetch() ignores `enabled` and would still fire the
        // doomed request on a chain without the source.
        refetch: (options?: RefetchOptions) =>
            isCapabilityOff ? Promise.resolve(query) : query.refetch(options),
    }
}
