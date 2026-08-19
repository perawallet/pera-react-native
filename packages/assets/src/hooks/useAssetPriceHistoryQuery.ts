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

import type { HistoryPeriod, Optional } from '@perawallet/wallet-core-shared'
import { useQuery, type RefetchOptions } from '@tanstack/react-query'
import {
    fetchAssetPriceHistory,
    transformAssetPriceHistoryResponse,
} from '../api'
import type {
    AssetPriceHistoryResponse,
    AssetPriceHistoryResponseItem,
} from '../api'
import { useCallback } from 'react'
import { getAssetPriceHistoryQueryKey } from './querykeys'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import type { AssetPriceHistory } from '../models'

export type UseAssetPriceHistoryQueryResult = {
    data: Optional<AssetPriceHistory>
    isPending: boolean
    isError: boolean
    isPaused: boolean
    isSuccess: boolean
    refetch: (options?: RefetchOptions) => unknown
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

export const useAssetPriceHistoryQuery = (
    assetID: string,
    period: HistoryPeriod,
): UseAssetPriceHistoryQueryResult => {
    const { network } = useNetwork()
    const isUnavailableOnNetwork = !isPeraBackedNetwork(network)
    const queryKey = getAssetPriceHistoryQueryKey(assetID, period, network)

    const query = useQuery({
        queryKey,
        queryFn: () => fetchAssetPriceHistory(assetID, period, network),
        enabled: !isUnavailableOnNetwork,
        select: useCallback(
            (data: AssetPriceHistoryResponse) =>
                data?.map((item: AssetPriceHistoryResponseItem) =>
                    transformAssetPriceHistoryResponse(item),
                ) ?? [],
            [],
        ),
    })

    return {
        data: query.data,
        isPending: isUnavailableOnNetwork ? false : query.isPending,
        isError: query.isError,
        isPaused: query.isPaused,
        isSuccess: query.isSuccess,
        // The observer's refetch() ignores `enabled` and would still fire the
        // doomed Pera request on a non-backed network.
        refetch: (options?: RefetchOptions) =>
            isUnavailableOnNetwork
                ? Promise.resolve(query)
                : query.refetch(options),
        isUnavailableOnNetwork,
    }
}
