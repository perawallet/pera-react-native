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
import { fetchAssetPriceHistory } from './endpoints'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { AssetPriceHistoryResponse } from '../models'
import { useCallback } from 'react'
import { mapAssetPriceHistoryResponseToAssetPriceHistoryItem } from './mappers'
import { getAssetPriceHistoryQueryKey } from './querykeys'

export const useAssetPriceHistoryQuery = (
    assetID: string,
    period: HistoryPeriod,
) => {
    const queryKey = getAssetPriceHistoryQueryKey(assetID, period)
    const { usdToPreferred } = useCurrency()

    return useQuery({
        queryKey,
        queryFn: () => fetchAssetPriceHistory(assetID, period),
        select: useCallback(
            (data: AssetPriceHistoryResponse) =>
                data.map(item =>
                    mapAssetPriceHistoryResponseToAssetPriceHistoryItem(
                        item,
                        usdToPreferred,
                    ),
                ),
            [usdToPreferred],
        ),
    })
}
