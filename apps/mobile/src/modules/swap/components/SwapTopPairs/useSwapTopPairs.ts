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

import { useCallback } from 'react'
import {
    useSwaps,
    useTopPairsQuery,
    type TopPairItem,
} from '@perawallet/wallet-core-swaps'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import {
    trackEvent,
    SwapEvent,
    AnalyticsMetadataKey,
} from '@perawallet/wallet-core-analytics'

const TOP_PAIRS_LIMIT = 5

export type UseSwapTopPairsResult = {
    pairs: TopPairItem[]
    isLoading: boolean
    isError: boolean
    handlePairPress: (pair: TopPairItem) => void
}

export const useSwapTopPairs = (): UseSwapTopPairsResult => {
    const { setFromAsset, setToAsset } = useSwaps()
    const { analytics } = usePeraProvider()
    const {
        data: pairs = [],
        isLoading,
        isError,
    } = useTopPairsQuery(TOP_PAIRS_LIMIT)

    const handlePairPress = useCallback(
        (pair: TopPairItem) => {
            analytics.logEvent('swap_top_pair_selected', {
                assetIn: pair.assetA.unitName,
                assetOut: pair.assetB.unitName,
            })
            trackEvent(SwapEvent.SelectTopPair, {
                [AnalyticsMetadataKey.SwapPairing]: `${pair.assetA.unitName}/${pair.assetB.unitName}`,
            })
            setFromAsset(pair.assetA.assetId)
            setToAsset(pair.assetB.assetId)
        },
        [analytics, setFromAsset, setToAsset],
    )

    return {
        pairs,
        isLoading,
        isError,
        handlePairPress,
    }
}
