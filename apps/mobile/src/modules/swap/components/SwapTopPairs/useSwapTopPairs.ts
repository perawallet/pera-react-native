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

import { useCallback } from 'react'
import {
    RemoteConfigKeys,
    useIsDeviceCountryRestricted,
} from '@perawallet/wallet-core-remote-config'
import {
    useSwaps,
    useTopPairsQuery,
    type TopPairItem,
} from '@perawallet/wallet-core-swaps'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'

const TOP_PAIRS_LIMIT = 5

export type UseSwapTopPairsResult = {
    pairs: TopPairItem[]
    isLoading: boolean
    isError: boolean
    handlePairPress: (pair: TopPairItem) => void
}

export const useSwapTopPairs = (scope: ChainScope): UseSwapTopPairsResult => {
    const { setFromAsset, setToAsset } = useSwaps(scope)
    const { analytics } = usePeraProvider()
    const isRestricted = useIsDeviceCountryRestricted(
        RemoteConfigKeys.crypto_promotion_restricted_countries,
    )
    const {
        data: pairs = [],
        isLoading,
        isError,
    } = useTopPairsQuery(scope, TOP_PAIRS_LIMIT, !isRestricted)

    const handlePairPress = useCallback(
        (pair: TopPairItem) => {
            analytics.logEvent('swap_top_pair_selected', {
                assetIn: pair.assetA.unitName,
                assetOut: pair.assetB.unitName,
                chain_id: scope.chainId,
            })
            trackEvent(SwapEvent.SelectTopPair, {
                [AnalyticsMetadataKey.ChainId]: scope.chainId,
                [AnalyticsMetadataKey.SwapPairing]: `${pair.assetA.unitName}/${pair.assetB.unitName}`,
            })
            setFromAsset(pair.assetA.assetId)
            setToAsset(pair.assetB.assetId)
        },
        [analytics, scope.chainId, setFromAsset, setToAsset],
    )

    return {
        // The persisted query cache can still hold pairs fetched before.
        pairs: isRestricted ? [] : pairs,
        isLoading,
        isError,
        handlePairPress,
    }
}
