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

import type { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useQuery } from '@tanstack/react-query'
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

export const useAssetPriceHistoryQuery = (
    assetID: string,
    period: HistoryPeriod,
) => {
    const { network } = useNetwork()
    const queryKey = getAssetPriceHistoryQueryKey(assetID, period, network)

    return useQuery({
        queryKey,
        queryFn: () => fetchAssetPriceHistory(assetID, period, network),
        select: useCallback(
            (data: AssetPriceHistoryResponse) =>
                data.map((item: AssetPriceHistoryResponseItem) =>
                    transformAssetPriceHistoryResponse(item),
                ),
            [],
        ),
    })
}
